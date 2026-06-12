/* =========================
   JELLYFIN HOVER TRAILER
   FULL STABLE VERSION
   SECURITY HARDENED
   + LOCAL TRAILERS TOGGLE
   + YOUTUBE TRAILERS TOGGLE
   + LOCAL > YOUTUBE > BACKDROP
   + YOUTUBE CUSTOM SOUND BUTTON
   + YOUTUBE CONTROL FLASH MASK
   + SCROLL LOCKED TO ORIGINAL CARD
   + NO API KEY IN VIDEO URL
   + SAFE INTERNAL NAVIGATION
========================= */

(function () {

    /* =========================
       INSTANCE CLEANUP
    ========================== */

    if (window.__jfHoverTrailerController) {
        try {
            window.__jfHoverTrailerController.abort();
        } catch {}
    }

    window.__jfHoverTrailerController =
        new AbortController();

    const JF_HOVER_SIGNAL =
        window.__jfHoverTrailerController.signal;

    function on(target, type, handler, options = {}) {
        const finalOptions =
            typeof options === "boolean"
                ? { capture: options }
                : { ...options };

        finalOptions.signal =
            JF_HOVER_SIGNAL;

        target.addEventListener(
            type,
            handler,
            finalOptions
        );
    }

    /* =========================
       CLEAN PREVIOUS DOM
    ========================== */

    document
        .querySelectorAll(".jf-hoverTrailer")
        .forEach(el => el.remove());

    const previousStyle =
        document.getElementById(
            "jf-hover-trailer-style"
        );

    if (previousStyle) {
        previousStyle.remove();
    }

    document
        .querySelectorAll("[data-hoverBound]")
        .forEach(el => {
            delete el.dataset.hoverBound;
        });

    /* =========================
       CONFIG
    ========================== */

    let DEBUG_HOVER = false;

    let PLUGIN_ENABLED = true;
    let ENABLE_LOCAL_TRAILERS = false;
    let ENABLE_YOUTUBE_TRAILERS = false;
    let PREFER_LOCAL_TRAILERS = true;

    let DISABLE_ON_TOUCH_DEVICES = true;
    let DISABLE_UNDER_WIDTH = 0;

    const DEFAULT_MOBILE_DISABLE_WIDTH = 768;

    let PLUGIN_CONFIG_LOADED = false;

    let LOCAL_TRAILER_COOLDOWN_MS = 800;
    let VIDEO_PRELOAD_MODE = "none";

    let INTERFACE_LANGUAGE = "fr";
    let NATIVE_LANGUAGE = "fr";
    let LANGUAGE_BADGE_MODE = "compact";
    let LANGUAGE_SEPARATOR = " • ";
    let SHOW_AUDIO_LANGUAGE_BADGES = true;
    let SHOW_SUBTITLE_LANGUAGE_BADGES = true;
    let PREFERRED_SUBTITLE_LANGUAGE = "fr";
    let lastLocalTrailerLookupAt = 0;

    let OPEN_DELAY = 310;
    let CLOSE_DELAY = 120;
    let CARD_TO_HOVER_GRACE = 420;

    let HOVER_SAFE_MARGIN = 70;
    let BRIDGE_HOLD_DELAY = 520;

    let YOUTUBE_REVEAL_DELAY = 950;

    const SCROLL_POINTER_LOCK_DELAY = 140;

    const states =
        new Set();

    const stateByCard =
        new WeakMap();

    const stateByHover =
        new WeakMap();

    let globalOpenTimer = null;
    let bridgeHoldTimer = null;
    let bridgeHoldState = null;

    let activeState = null;

    let scrollRaf = null;
    let pointerRaf = null;
    let lastPointerEvent = null;

    let isScrolling = false;
    let scrollUnlockTimer = null;

    let lastPointerX = 0;
    let lastPointerY = 0;

    /* =========================
       PLUGIN CONFIG + CACHE
    ========================== */

    const itemCache =
        new Map();

    const trailerCache =
        new Map();

    const MAX_CACHE_ITEMS =
        160;

    let globalLoadToken =
        0;

    function trimCache(cache) {
        if (cache.size <= MAX_CACHE_ITEMS)
            return;

        const firstKey =
            cache.keys().next().value;

        if (firstKey !== undefined) {
            cache.delete(firstKey);
        }
    }

    function getConfigNumber(config, key, fallback) {

        const value =
            Number(config?.[key]);

        return Number.isFinite(value)
            ? value
            : fallback;
    }

    const CINEMA_HOVER_MAX_WAIT_MS =
        15000;

    const CINEMA_HOVER_EXTRA_DELAY_MS =
        1400;

    function hasCinemaHoverApiClientReady() {
        try {
            return Boolean(
                window.ApiClient &&
                typeof window.ApiClient.getCurrentUserId === "function" &&
                window.ApiClient.getCurrentUserId()
            );
        } catch {
            return false;
        }
    }

    function hasCinemaHoverCardsReady() {
        return (
            document.querySelectorAll('.card[data-type="Movie"], .card[data-type="Series"]').length > 0 ||
            document.querySelectorAll('.card[data-type="Series"]').length > 0
        );
    }

    function waitForCinemaHoverRuntime() {
        return new Promise(resolve => {
            const startedAt =
                Date.now();

            const timer =
                setInterval(() => {
                    const ready =
                        hasCinemaHoverApiClientReady() &&
                        hasCinemaHoverCardsReady();

                    const timeout =
                        Date.now() - startedAt > CINEMA_HOVER_MAX_WAIT_MS;

                    if (!ready && !timeout) {
                        return;
                    }

                    clearInterval(
                        timer
                    );

                    setTimeout(
                        resolve,
                        CINEMA_HOVER_EXTRA_DELAY_MS
                    );
                }, 250);
        });
    }

    async function loadCinemaHoverPluginConfig() {
        try {
            const response =
                await fetch(
                    "/CinemaHover/config",
                    {
                        credentials: "same-origin",
                        cache: "no-store"
                    }
                );

            if (!response.ok) {
                console.warn(
                    "[CinemaHover] Config plugin indisponible:",
                    response.status
                );

                PLUGIN_CONFIG_LOADED = true;
                return;
            }

            const config =
                await response.json();

            PLUGIN_ENABLED =
                config.Enabled !== false;

            ENABLE_LOCAL_TRAILERS =
                config.EnableLocalTrailers === true;

            ENABLE_YOUTUBE_TRAILERS =
                config.EnableYouTubeTrailers === true;

            PREFER_LOCAL_TRAILERS =
                config.PreferLocalTrailers !== false;

            DEBUG_HOVER =
                config.Debug === true;

            DISABLE_ON_TOUCH_DEVICES =
                config.DisableOnTouchDevices !== false;

            DISABLE_UNDER_WIDTH =
                Number.isFinite(Number(config.DisableUnderWidth))
                    ? Number(config.DisableUnderWidth)
                    : 0;

            LOCAL_TRAILER_COOLDOWN_MS =
                Number.isFinite(Number(config.LocalTrailerCooldownMs))
                    ? Math.max(0, Number(config.LocalTrailerCooldownMs))
                    : 800;

            const preloadMode =
                String(config.VideoPreloadMode || "none")
                    .toLowerCase()
                    .trim();

            VIDEO_PRELOAD_MODE =
                ["none", "metadata", "auto"].includes(preloadMode)
                    ? preloadMode
                    : "none";

            INTERFACE_LANGUAGE =
                config.InterfaceLanguage === "en"
                    ? "en"
                    : "fr";

            NATIVE_LANGUAGE =
                config.NativeLanguage === "en"
                    ? "en"
                    : "fr";

            LANGUAGE_BADGE_MODE =
                config.LanguageBadgeMode === "compact"
                    ? "compact"
                    : "compact";

            LANGUAGE_SEPARATOR =
                typeof config.LanguageSeparator === "string"
                    ? config.LanguageSeparator
                    : " • ";

            SHOW_AUDIO_LANGUAGE_BADGES =
                config.ShowAudioLanguageBadges !== false;

            SHOW_SUBTITLE_LANGUAGE_BADGES =
                config.ShowSubtitleLanguageBadges !== false;

            PREFERRED_SUBTITLE_LANGUAGE =
                ["fr", "en", "all"].includes(config.PreferredSubtitleLanguage)
                    ? config.PreferredSubtitleLanguage
                    : "fr";

            OPEN_DELAY =
                getConfigNumber(
                    config,
                    "OpenDelay",
                    OPEN_DELAY
                );

            CLOSE_DELAY =
                getConfigNumber(
                    config,
                    "CloseDelay",
                    CLOSE_DELAY
                );

            CARD_TO_HOVER_GRACE =
                getConfigNumber(
                    config,
                    "CardToHoverGrace",
                    CARD_TO_HOVER_GRACE
                );

            HOVER_SAFE_MARGIN =
                getConfigNumber(
                    config,
                    "HoverSafeMargin",
                    HOVER_SAFE_MARGIN
                );

            BRIDGE_HOLD_DELAY =
                getConfigNumber(
                    config,
                    "BridgeHoldDelay",
                    BRIDGE_HOLD_DELAY
                );

            YOUTUBE_REVEAL_DELAY =
                getConfigNumber(
                    config,
                    "YouTubeRevealDelay",
                    YOUTUBE_REVEAL_DELAY
                );

            PLUGIN_CONFIG_LOADED =
                true;

            console.log(
                "[CinemaHover] Config plugin chargée",
                {
                    PLUGIN_ENABLED,
                    ENABLE_LOCAL_TRAILERS,
                    ENABLE_YOUTUBE_TRAILERS,
                    PREFER_LOCAL_TRAILERS,
                    DISABLE_ON_TOUCH_DEVICES,
                    DISABLE_UNDER_WIDTH
                }
            );

        } catch (error) {
            console.warn(
                "[CinemaHover] Impossible de charger la config plugin",
                error
            );

            PLUGIN_CONFIG_LOADED = true;
        }
    }

    function isTouchDevice() {
        return Boolean(
            (
                window.matchMedia &&
                (
                    window.matchMedia("(pointer: coarse)").matches ||
                    window.matchMedia("(hover: none)").matches ||
                    window.matchMedia("(any-pointer: coarse)").matches ||
                    window.matchMedia("(any-hover: none)").matches
                )
            ) ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0 ||
            "ontouchstart" in window
        );
    }

    function isMobileLayout() {
        return window.innerWidth <= DEFAULT_MOBILE_DISABLE_WIDTH;
    }

    function shouldDisableCinemaHoverRuntime() {
        return Boolean(
            !PLUGIN_ENABLED ||
            (
                DISABLE_ON_TOUCH_DEVICES &&
                (
                    isTouchDevice() ||
                    isMobileLayout()
                )
            ) ||
            (
                DISABLE_UNDER_WIDTH > 0 &&
                window.innerWidth < DISABLE_UNDER_WIDTH
            )
        );
    }

    function disableCinemaHoverRuntime(reason) {
        clearTimeout(globalOpenTimer);
        clearBridgeHold();
        destroyAllHovers();

        document
            .querySelectorAll(".jf-hoverTrailer")
            .forEach(el => el.remove());

        document
            .querySelectorAll("[data-hoverBound]")
            .forEach(card => {
                delete card.dataset.hoverBound;
            });

        console.log("[CinemaHover] Runtime disabled.", {
            reason,
            pluginEnabled: PLUGIN_ENABLED,
            disableOnTouchDevices: DISABLE_ON_TOUCH_DEVICES,
            disableUnderWidth: DISABLE_UNDER_WIDTH,
            touch: isTouchDevice(),
            mobileLayout: isMobileLayout(),
            innerWidth: window.innerWidth,
            hoverBound: document.querySelectorAll("[data-hoverBound]").length,
            hoverPanels: document.querySelectorAll(".jf-hoverTrailer").length,
            visibleHoverPanels: document.querySelectorAll(".jf-hoverTrailer.jf-hover-visible").length
        });
    }

    async function getCachedItem(itemId) {
        if (!itemId)
            return null;

        if (itemCache.has(itemId)) {
            return await itemCache.get(itemId);
        }

        const itemPromise =
            window.ApiClient.getItem(
                window.ApiClient.getCurrentUserId(),
                itemId
            );

        itemCache.set(
            itemId,
            itemPromise
        );

        trimCache(
            itemCache
        );

        try {
            const item =
                await itemPromise;

            itemCache.set(
                itemId,
                Promise.resolve(item)
            );

            return item;

        } catch (error) {
            itemCache.delete(itemId);
            throw error;
        }
    }

    async function getCachedLocalTrailers(itemId) {
        if (!itemId)
            return [];

        if (trailerCache.has(itemId)) {
            return await trailerCache.get(itemId);
        }

        const trailersPromise =
            window.ApiClient.getLocalTrailers(
                window.ApiClient.getCurrentUserId(),
                itemId
            );

        trailerCache.set(
            itemId,
            trailersPromise
        );

        trimCache(
            trailerCache
        );

        try {
            const trailers =
                await trailersPromise;

            const safeTrailers =
                trailers || [];

            trailerCache.set(
                itemId,
                Promise.resolve(safeTrailers)
            );

            return safeTrailers;

        } catch (error) {
            trailerCache.delete(itemId);
            throw error;
        }
    }

    /* =========================
       HELPERS
    ========================== */

    function normalizeValue(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\./g, "")
            .replace(/_/g, " ")
            .replace(/-/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function isSafeHoverImageUrl(value) {
        if (typeof value !== "string") {
            return false;
        }

        const trimmed =
            value.trim();

        if (!trimmed) {
            return false;
        }

        if (
            trimmed.includes("\n") ||
            trimmed.includes("\r") ||
            trimmed.includes("\"") ||
            trimmed.includes("'") ||
            trimmed.includes(")")
        ) {
            return false;
        }

        return (
            trimmed.startsWith("/") ||
            trimmed.startsWith(window.location.origin)
        );
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function flagEmojiFromCode(code) {
        if (
            !code ||
            code.length !== 2
        ) {
            return "";
        }

        return code
            .toUpperCase()
            .replace(/./g, char =>
                String.fromCodePoint(
                    127397 +
                    char.charCodeAt()
                )
            );
    }

    function isSafeJellyfinHref(href) {
        if (typeof href !== "string")
            return false;

        const value =
            href.trim();

        if (!value)
            return false;

        if (!value.startsWith("#/"))
            return false;

        if (
            value.includes("\n") ||
            value.includes("\r")
        ) {
            return false;
        }

        if (
            value.toLowerCase()
                .startsWith("javascript:")
        ) {
            return false;
        }

        return true;
    }

    function clearBridgeHold() {
        clearTimeout(
            bridgeHoldTimer
        );

        bridgeHoldTimer = null;
        bridgeHoldState = null;
    }

    /* =========================
       COUNTRY FLAGS
    ========================== */

    const COUNTRY_TO_CODE = {
        "france": "fr",
        "french": "fr",
        "fr": "fr",

        "united states": "us",
        "united states of america": "us",
        "usa": "us",
        "us": "us",
        "america": "us",
        "etats unis": "us",

        "united kingdom": "gb",
        "great britain": "gb",
        "uk": "gb",
        "england": "gb",
        "royaume uni": "gb",

        "japan": "jp",
        "japon": "jp",
        "jp": "jp",

        "south korea": "kr",
        "korea": "kr",
        "coree du sud": "kr",
        "kr": "kr",

        "north korea": "kp",
        "coree du nord": "kp",

        "china": "cn",
        "chine": "cn",
        "cn": "cn",

        "taiwan": "tw",
        "hong kong": "hk",

        "india": "in",
        "inde": "in",

        "iran": "ir",
        "ir": "ir",

        "iraq": "iq",
        "irak": "iq",

        "turkey": "tr",
        "turquie": "tr",

        "israel": "il",

        "thailand": "th",
        "thailande": "th",

        "vietnam": "vn",

        "philippines": "ph",

        "indonesia": "id",
        "indonesie": "id",

        "italy": "it",
        "italie": "it",

        "spain": "es",
        "espagne": "es",

        "germany": "de",
        "allemagne": "de",

        "russia": "ru",
        "russie": "ru",

        "ukraine": "ua",

        "belgium": "be",
        "belgique": "be",

        "canada": "ca",

        "mexico": "mx",
        "mexique": "mx",

        "brazil": "br",
        "bresil": "br",

        "argentina": "ar",
        "argentine": "ar",

        "chile": "cl",
        "chili": "cl",

        "colombia": "co",
        "colombie": "co",

        "australia": "au",
        "australie": "au",

        "new zealand": "nz",
        "nouvelle zelande": "nz",

        "sweden": "se",
        "suede": "se",

        "norway": "no",
        "norvege": "no",

        "denmark": "dk",
        "danemark": "dk",

        "finland": "fi",
        "finlande": "fi",

        "poland": "pl",
        "pologne": "pl",

        "netherlands": "nl",
        "pays bas": "nl",

        "switzerland": "ch",
        "suisse": "ch",

        "austria": "at",
        "autriche": "at",

        "portugal": "pt",

        "greece": "gr",
        "grece": "gr",

        "ireland": "ie",
        "irlande": "ie",

        "morocco": "ma",
        "maroc": "ma",

        "algeria": "dz",
        "algerie": "dz",

        "tunisia": "tn",
        "tunisie": "tn",

        "egypt": "eg",
        "egypte": "eg",

        "south africa": "za",
        "afrique du sud": "za",

        "senegal": "sn"
    };

    const AUDIO_LANG_TO_COUNTRY = {
        fra: "fr",
        fre: "fr",
        fr: "fr",

        eng: "us",
        en: "us",

        jpn: "jp",
        ja: "jp",

        kor: "kr",
        ko: "kr",

        chi: "cn",
        zho: "cn",
        zh: "cn",

        rus: "ru",
        ru: "ru",

        fas: "ir",
        per: "ir",
        fa: "ir",

        ita: "it",
        it: "it",

        spa: "es",
        es: "es",

        deu: "de",
        ger: "de",
        de: "de",

        tur: "tr",
        tr: "tr",

        hin: "in",
        hi: "in",

        por: "pt",
        pt: "pt"
    };

    function getFlagHtml(code) {
        if (!code) return "";

        const emoji =
            flagEmojiFromCode(code);

        if (!emoji) return "";

        return `
            <span
                class="jf-hover-flagBox"
                title="${escapeHtml(code.toUpperCase())}"
                aria-label="${escapeHtml(code.toUpperCase())}"
            >
                ${escapeHtml(emoji)}
            </span>
        `;
    }

    function getCountryFlags(item) {
        const rawCountries = [
            ...(item.ProductionCountries || []),
            ...(item.ProductionLocations || []),
            item.Country,
            item.OriginalCountry
        ].filter(Boolean);

        let codes =
            rawCountries
                .map(country => {
                    const key =
                        normalizeValue(country);

                    return (
                        COUNTRY_TO_CODE[key] ||
                        ""
                    );
                })
                .filter(Boolean);

        if (!codes.length && item.MediaStreams) {
            const audioStreams =
                item.MediaStreams.filter(
                    s => s.Type === "Audio"
                );

            const nonFrenchAudio =
                audioStreams.find(stream => {
                    const lang =
                        normalizeValue(
                            stream.Language ||
                            stream.DisplayTitle ||
                            ""
                        );

                    return (
                        lang &&
                        !lang.includes("fra") &&
                        !lang.includes("fre") &&
                        !lang.includes("francais") &&
                        !lang.includes("french") &&
                        lang !== "fr"
                    );
                });

            const fallbackLang =
                normalizeValue(
                    nonFrenchAudio?.Language ||
                    audioStreams[0]?.Language ||
                    ""
                );

            const fallbackCode =
                AUDIO_LANG_TO_COUNTRY[
                    fallbackLang
                ];

            if (fallbackCode) {
                codes.push(fallbackCode);
            }
        }

        codes =
            [...new Set(codes)]
                .slice(0, 3);

        return codes
            .map(code =>
                getFlagHtml(code)
            )
            .join("");
    }

    /* =========================
       LANGUAGES
    ========================== */

    const LANGUAGE_ALIASES = {
        fr: [
            "fr",
            "fra",
            "fre",
            "french",
            "francais",
            "français"
        ],

        en: [
            "en",
            "eng",
            "english",
            "anglais"
        ],

        ja: [
            "ja",
            "jpn",
            "japanese",
            "japonais"
        ],

        ko: [
            "ko",
            "kor",
            "korean",
            "coreen",
            "coréen"
        ],

        zh: [
            "zh",
            "chi",
            "zho",
            "chinese",
            "chinois",
            "mandarin",
            "cantonese",
            "cantonais"
        ],

        ru: [
            "ru",
            "rus",
            "russian",
            "russe"
        ],

        es: [
            "es",
            "spa",
            "spanish",
            "espagnol",
            "castilian"
        ],

        de: [
            "de",
            "ger",
            "deu",
            "german",
            "allemand"
        ],

        it: [
            "it",
            "ita",
            "italian",
            "italien"
        ],

        pt: [
            "pt",
            "por",
            "portuguese",
            "portugais"
        ],

        ar: [
            "ar",
            "ara",
            "arabic",
            "arabe"
        ],

        hi: [
            "hi",
            "hin",
            "hindi"
        ],

        tr: [
            "tr",
            "tur",
            "turkish",
            "turc"
        ],

        nl: [
            "nl",
            "dut",
            "nld",
            "dutch",
            "neerlandais",
            "néerlandais"
        ],

        pl: [
            "pl",
            "pol",
            "polish",
            "polonais"
        ],

        sv: [
            "sv",
            "swe",
            "swedish",
            "suedois",
            "suédois"
        ],

        da: [
            "da",
            "dan",
            "danish",
            "danois"
        ],

        no: [
            "no",
            "nor",
            "norwegian",
            "norvegien",
            "norvégien"
        ],

        fi: [
            "fi",
            "fin",
            "finnish",
            "finnois"
        ]
    };

    const HOVER_I18N = {
        fr: {
            directedBy: "De",
            soundToggle: "Activer ou désactiver le son",
            originalAudio: "VO",
            frenchSubsWithOriginal: "VOSTFR"
        },

        en: {
            directedBy: "Directed by",
            soundToggle: "Toggle sound",
            originalAudio: "Original",
            frenchSubsWithOriginal: "FR subs"
        }
    };

    function getHoverLanguage() {

        return INTERFACE_LANGUAGE === "en"
            ? "en"
            : "fr";
    }

    function ht(key) {

        const lang =
            getHoverLanguage();

        return (
            HOVER_I18N[lang]?.[key] ||
            HOVER_I18N.fr[key] ||
            key
        );
    }

    function detectLanguageCode(value) {

        const normalized =
            normalizeValue(value);

        if (!normalized) {
            return "";
        }

        for (const [code, aliases] of Object.entries(LANGUAGE_ALIASES)) {
            if (
                aliases.some(alias =>
                    normalized === normalizeValue(alias) ||
                    normalized.includes(normalizeValue(alias))
                )
            ) {
                return code;
            }
        }

        if (/^[a-z]{2}$/.test(normalized)) {
            return normalized;
        }

        if (/^[a-z]{3}$/.test(normalized)) {
            return normalized;
        }

        return "";
    }

    function getStreamLanguageCode(stream) {

        if (!stream) {
            return "";
        }

        return (
            detectLanguageCode(stream.Language) ||
            detectLanguageCode(stream.DisplayTitle) ||
            detectLanguageCode(stream.Title) ||
            detectLanguageCode(stream.Codec)
        );
    }

    function getOrderedAudioLanguageCodes(item) {

        const codes = [];

        (item.MediaStreams || [])
            .filter(stream => stream.Type === "Audio")
            .forEach(stream => {
                const code =
                    getStreamLanguageCode(stream);

                if (
                    code &&
                    !codes.includes(code)
                ) {
                    codes.push(code);
                }
            });

        return codes;
    }

    function getOrderedSubtitleLanguageCodes(item) {

        const codes = [];

        (item.MediaStreams || [])
            .filter(stream => stream.Type === "Subtitle")
            .forEach(stream => {
                const code =
                    getStreamLanguageCode(stream);

                if (
                    code &&
                    !codes.includes(code)
                ) {
                    codes.push(code);
                }
            });

        return codes;
    }

    function getOriginalLanguageCodeFromStreams(item) {

        const audioStreams =
            (item.MediaStreams || [])
                .filter(stream => stream.Type === "Audio");

        for (const stream of audioStreams) {
            const code =
                getStreamLanguageCode(stream);

            if (!code) {
                continue;
            }

            const title =
                normalizeValue(
                    [
                        stream.DisplayTitle,
                        stream.Title,
                        stream.Comment
                    ]
                        .filter(Boolean)
                        .join(" ")
                );

            if (
                title.includes("original") ||
                title.includes("version originale") ||
                title.includes("vo ") ||
                title === "vo" ||
                title.includes(" vost") ||
                title.includes("vostfr")
            ) {
                return code;
            }
        }

        return "";
    }

    function getOriginalLanguageCode(item) {

        const candidates = [
            item.OriginalLanguage,
            item.OriginalAudioLanguage,
            item.PreferredMetadataLanguage
        ];

        for (const candidate of candidates) {
            const code =
                detectLanguageCode(candidate);

            if (code) {
                return code;
            }
        }

        return getOriginalLanguageCodeFromStreams(item);
    }

    function getNativeLanguageCode() {

        return NATIVE_LANGUAGE === "en"
            ? "en"
            : "fr";
    }

    function getNativeDubLabel() {

        return getNativeLanguageCode() === "en"
            ? "Dub"
            : "VF";
    }

    function getNativeSubLabel() {

        return getNativeLanguageCode() === "en"
            ? "Sub"
            : "VOST";
    }

    function getOriginalLabel() {

        return getNativeLanguageCode() === "en"
            ? "Original"
            : "VO";
    }

    function dedupeValues(values) {

        return values.filter((value, index) =>
            value &&
            values.indexOf(value) === index
        );
    }

    function getLanguages(item) {

        if (!item.MediaStreams) {
            return "";
        }

        const nativeCode =
            getNativeLanguageCode();

        const audioCodes =
            getOrderedAudioLanguageCodes(item);

        const subtitleCodes =
            getOrderedSubtitleLanguageCodes(item);

        const originalCode =
            getOriginalLanguageCode(item);

        const hasNativeAudio =
            audioCodes.includes(nativeCode);

        const hasNativeSubtitles =
            subtitleCodes.includes(nativeCode);

        /*
           Si Jellyfin connaît explicitement la langue originale,
           on exige une piste audio correspondant à cette langue.
        */
        const hasExplicitOriginalAudio =
            Boolean(
                originalCode &&
                audioCodes.includes(originalCode)
            );

        /*
           Si Jellyfin ne fournit pas de langue originale exploitable,
           on restaure une détection souple :
           une piste audio différente de la langue native est considérée
           comme une VO probable.
        */
        const hasFallbackOriginalAudio =
            Boolean(
                !originalCode &&
                audioCodes.some(code => code !== nativeCode)
            );

        const hasOriginalAudio =
            hasExplicitOriginalAudio ||
            hasFallbackOriginalAudio;

        const originalIsNative =
            Boolean(
                originalCode &&
                originalCode === nativeCode
            );

        const badges = [];

        if (nativeCode === "fr") {
            /*
               Règle française finale :

               - Si la VO est française :
                 VF
                 VF • VOST si sous-titres français présents

               - Si la VO n'est pas française :
                 VF si audio français disponible
                 VOST si VO + sous-titres français disponibles
                 VO seulement si VO sans sous-titres français

               Important :
               on n'affiche jamais VO • VOST.
               VOST remplace VO quand les sous-titres français existent.
            */
            if (
                originalIsNative &&
                hasNativeAudio
            ) {
                badges.push(
                    "VF"
                );

                if (hasNativeSubtitles) {
                    badges.push(
                        "VOST"
                    );
                }

                return dedupeValues(badges)
                    .join(LANGUAGE_SEPARATOR);
            }

            if (hasNativeAudio) {
                badges.push(
                    "VF"
                );
            }

            if (
                hasOriginalAudio &&
                hasNativeSubtitles
            ) {
                badges.push(
                    "VOST"
                );
            } else if (hasOriginalAudio) {
                badges.push(
                    "VO"
                );
            }

            return dedupeValues(badges)
                .join(LANGUAGE_SEPARATOR);
        }

        if (nativeCode === "en") {
            /*
               Règle anglaise finale :

               - Si la VO est anglaise :
                 EN
                 EN • EN Sub si sous-titres anglais présents

               - Si la VO n'est pas anglaise :
                 Dub • Original • Sub
            */
            if (
                originalIsNative &&
                hasNativeAudio
            ) {
                badges.push(
                    "EN"
                );

                if (hasNativeSubtitles) {
                    badges.push(
                        "EN Sub"
                    );
                }

                return dedupeValues(badges)
                    .join(LANGUAGE_SEPARATOR);
            }

            if (hasNativeAudio) {
                badges.push(
                    "Dub"
                );
            }

            if (hasOriginalAudio) {
                badges.push(
                    "Original"
                );
            }

            if (
                hasOriginalAudio &&
                hasNativeSubtitles
            ) {
                badges.push(
                    "Sub"
                );
            }

            return dedupeValues(badges)
                .join(LANGUAGE_SEPARATOR);
        }

        return "";
    }

    /* =========================
       YOUTUBE TRAILERS
    ========================== */

    function extractYouTubeId(value) {
        if (!value) return "";

        const text =
            String(value).trim();

        if (
            /^[a-zA-Z0-9_-]{11}$/.test(text)
        ) {
            return text;
        }

        try {
            const url =
                new URL(text);

            const host =
                url.hostname
                    .toLowerCase()
                    .replace(/^www\./, "");

            if (host === "youtu.be") {
                const id =
                    url.pathname
                        .split("/")
                        .filter(Boolean)[0];

                return /^[a-zA-Z0-9_-]{11}$/.test(id)
                    ? id
                    : "";
            }

            if (
                host === "youtube.com" ||
                host === "m.youtube.com" ||
                host === "music.youtube.com" ||
                host === "youtube-nocookie.com"
            ) {
                const v =
                    url.searchParams.get("v");

                if (
                    v &&
                    /^[a-zA-Z0-9_-]{11}$/.test(v)
                ) {
                    return v;
                }

                const parts =
                    url.pathname
                        .split("/")
                        .filter(Boolean);

                const embedIndex =
                    parts.indexOf("embed");

                if (
                    embedIndex >= 0 &&
                    parts[embedIndex + 1] &&
                    /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIndex + 1])
                ) {
                    return parts[embedIndex + 1];
                }

                const shortsIndex =
                    parts.indexOf("shorts");

                if (
                    shortsIndex >= 0 &&
                    parts[shortsIndex + 1] &&
                    /^[a-zA-Z0-9_-]{11}$/.test(parts[shortsIndex + 1])
                ) {
                    return parts[shortsIndex + 1];
                }
            }

        } catch {}

        return "";
    }

    function getYouTubeTrailerId(item) {
        const candidates = [];

        if (
            Array.isArray(
                item.RemoteTrailers
            )
        ) {
            item.RemoteTrailers.forEach(trailer => {
                candidates.push(
                    trailer.Url,
                    trailer.Id,
                    trailer.Name
                );
            });
        }

        if (
            Array.isArray(
                item.ExternalUrls
            )
        ) {
            item.ExternalUrls.forEach(url => {
                candidates.push(
                    url.Url,
                    url.Name
                );
            });
        }

        candidates.push(
            item.TrailerUrl,
            item.YoutubeTrailerId
        );

        for (const candidate of candidates) {
            const id =
                extractYouTubeId(candidate);

            if (id) return id;
        }

        return "";
    }

    function getYouTubeEmbedUrl(videoId) {
        if (
            !videoId ||
            !/^[a-zA-Z0-9_-]{11}$/.test(videoId)
        ) {
            return "";
        }

        const params =
            new URLSearchParams({
                autoplay: "1",
                mute: "1",
                controls: "0",
                playsinline: "1",
                loop: "1",
                playlist: videoId,
                rel: "0",
                iv_load_policy: "3",
                disablekb: "1",
                fs: "0",
                modestbranding: "1",
                enablejsapi: "1",
                origin: window.location.origin
            });

        return (
            "https://www.youtube-nocookie.com/embed/" +
            encodeURIComponent(videoId) +
            "?" +
            params.toString()
        );
    }

    function sendYouTubeCommand(
        state,
        command,
        args = []
    ) {
        if (!state) return;

        const iframe =
            state.youtubeFrame ||
            state.hover?.querySelector(
                ".jf-hover-youtube"
            );

        if (
            !iframe ||
            !iframe.contentWindow
        ) {
            return;
        }

        try {
            iframe.contentWindow.postMessage(
                JSON.stringify({
                    event: "command",
                    func: command,
                    args
                }),
                "*"
            );
        } catch {}
    }

    function setYouTubeMuted(state, muted) {
        if (!state) return;

        state.youtubeMuted =
            muted;

        sendYouTubeCommand(
            state,
            "playVideo"
        );

        if (muted) {
            sendYouTubeCommand(
                state,
                "mute"
            );
        } else {
            sendYouTubeCommand(
                state,
                "setVolume",
                [100]
            );

            sendYouTubeCommand(
                state,
                "unMute"
            );
        }

        const soundIcon =
            state.hover?.querySelector(
                ".jf-hover-sound-icon"
            );

        if (soundIcon) {
            soundIcon.textContent =
                muted ? "🔇" : "🔊";
        }
    }

    /* =========================
       STATE
    ========================== */

    function getState(card) {
        let state =
            stateByCard.get(card);

        if (
            state &&
            state.hover &&
            document.body.contains(
                state.hover
            )
        ) {
            return state;
        }

        if (state) {
            states.delete(state);
            stateByCard.delete(card);
        }

        const hover =
            document.createElement("div");

        hover.className =
            "jf-hoverTrailer";

        hover.setAttribute(
            "data-jf-hover-trailer",
            "true"
        );

        document.body.appendChild(
            hover
        );

        state = {
            card,
            hover,
            loaded: false,
            loading: null,
            item: null,
            video: null,
            youtubeFrame: null,
            youtubeMuted: true,
            href: null,
            closeTimer: null,
            youtubeRevealTimer: null,
            requestId: 0,
            isOpen: false,
            pointerInsideCard: false,
            pointerInsideHover: false
        };

        on(
            hover,
            "mouseenter",
            () => {
                clearBridgeHold();

                state.pointerInsideHover =
                    true;

                activeState =
                    state;

                clearTimeout(
                    state.closeTimer
                );

                ensureMediaPlaying(
                    state
                );
            }
        );

        on(
            hover,
            "mouseleave",
            () => {
                state.pointerInsideHover =
                    false;

                scheduleClose(
                    state,
                    CLOSE_DELAY
                );
            }
        );

        stateByCard.set(
            card,
            state
        );

        stateByHover.set(
            hover,
            state
        );

        states.add(
            state
        );

        return state;
    }

    function cleanupDisconnectedStates() {
        states.forEach(state => {
            if (
                !document.body.contains(
                    state.card
                )
            ) {
                try {
                    resetMediaState(state);

                    state.hover.remove();
                } catch {}

                states.delete(state);

                if (activeState === state) {
                    activeState = null;
                }
            }
        });
    }

    function resetMediaState(state) {
        if (!state) return;

        clearTimeout(
            state.youtubeRevealTimer
        );

        state.youtubeRevealTimer = null;

        const video =
            state.video ||
            state.hover?.querySelector(
                ".jf-hover-video"
            );

        const youtubeFrame =
            state.youtubeFrame ||
            state.hover?.querySelector(
                ".jf-hover-youtube"
            );

        const soundIcon =
            state.hover?.querySelector(
                ".jf-hover-sound-icon"
            );

        state.youtubeMuted = true;

        state.videoPlayPending =
            false;

        if (video) {
            try {
                video.muted = true;
                video.volume = 1;

                video.pause();

                video.currentTime = 0;
            } catch {}
        }

        if (youtubeFrame) {
            try {
                setYouTubeMuted(
                    state,
                    true
                );

                youtubeFrame.classList.remove(
                    "jf-hover-youtube-ready"
                );

                youtubeFrame.src =
                    "about:blank";
            } catch {}
        }

        if (soundIcon) {
            soundIcon.textContent =
                "🔇";
        }
    }

    function ensureVideoPlaying(state) {
        if (
            !state ||
            !state.isOpen
        ) {
            return;
        }

        const video =
            state.video ||
            state.hover?.querySelector(
                ".jf-hover-video"
            );

        if (!video) return;

        state.video =
            video;

        if (
            !video.src &&
            video.dataset.src
        ) {
            try {
                video.src =
                    video.dataset.src;

                video.load();
            } catch {}
        }

        if (state.videoPlayPending) {
            return;
        }

        state.videoPlayPending =
            true;

        requestAnimationFrame(() => {
            try {
                if (
                    state.isOpen &&
                    video.paused
                ) {
                    video.play()
                        .catch(() => {});
                }
            } catch {}

            setTimeout(() => {
                if (state) {
                    state.videoPlayPending =
                        false;
                }
            }, 750);
        });
    }

    function ensureYoutubePlaying(state) {
        if (
            !state ||
            !state.isOpen
        ) {
            return;
        }

        const youtubeFrame =
            state.youtubeFrame ||
            state.hover?.querySelector(
                ".jf-hover-youtube"
            );

        if (!youtubeFrame) return;

        state.youtubeFrame =
            youtubeFrame;

        const src =
            youtubeFrame.dataset.src || "";

        if (
            src &&
            (
                !youtubeFrame.src ||
                youtubeFrame.src === "about:blank"
            )
        ) {
            youtubeFrame.src = src;
        }

        /*
           Ne pas envoyer playVideo/mute/unMute en boucle ici.
           Cette fonction peut être appelée via pointermove.
           YouTube est commandé à l'ouverture du hover et au clic son.
        */
    }

    function ensureMediaPlaying(state) {
        ensureVideoPlaying(state);
        ensureYoutubePlaying(state);
    }

    function closeState(state) {
        if (!state) return;

        clearTimeout(
            state.closeTimer
        );

        clearTimeout(
            state.youtubeRevealTimer
        );

        state.youtubeRevealTimer = null;

        if (activeState === state) {
            clearBridgeHold();
        }

        state.isOpen = false;

        state.pointerInsideCard = false;
        state.pointerInsideHover = false;

        resetMediaState(state);

        state.hover?.classList.remove(
            "jf-hover-visible"
        );

        if (activeState === state) {
            activeState = null;
        }
    }

    function closeAllExcept(exceptState) {
        states.forEach(state => {
            if (state !== exceptState) {
                closeState(state);
            }
        });
    }

    function destroyVideoHard(state) {
        if (!state) return;

        const video =
            state.video ||
            state.hover?.querySelector(
                ".jf-hover-video"
            );

        const youtubeFrame =
            state.youtubeFrame ||
            state.hover?.querySelector(
                ".jf-hover-youtube"
            );

        if (video) {
            try {
                video.pause();

                video.removeAttribute(
                    "src"
                );

                video
                    .querySelectorAll("source")
                    .forEach(source => {
                        source.removeAttribute("src");
                    });

                video.load();
            } catch {}
        }

        if (youtubeFrame) {
            try {
                youtubeFrame.src =
                    "about:blank";
            } catch {}
        }

        state.video = null;
        state.youtubeFrame = null;
    }

    function destroyAllHovers() {
        clearTimeout(globalOpenTimer);
        clearBridgeHold();

        states.forEach(state => {
            clearTimeout(state.closeTimer);
            clearTimeout(state.youtubeRevealTimer);

            resetMediaState(state);

            destroyVideoHard(state);

            state.isOpen = false;
            state.pointerInsideCard = false;
            state.pointerInsideHover = false;

            try {
                state.hover?.classList.remove(
                    "jf-hover-visible"
                );

                state.hover?.remove();
            } catch {}
        });

        states.clear();

        activeState = null;

        document
            .querySelectorAll(".jf-hoverTrailer")
            .forEach(el => el.remove());
    }

    function scheduleBridgeHoldClose(state) {
        if (
            bridgeHoldTimer &&
            bridgeHoldState === state
        ) {
            return;
        }

        clearTimeout(
            bridgeHoldTimer
        );

        bridgeHoldState =
            state;

        bridgeHoldTimer =
            setTimeout(() => {
                bridgeHoldTimer = null;
                bridgeHoldState = null;

                if (
                    !state ||
                    state !== activeState ||
                    !state.isOpen
                ) {
                    return;
                }

                const realHoverState =
                    getVisibleHoverStateAtPoint(
                        lastPointerX,
                        lastPointerY
                    );

                if (
                    realHoverState === state ||
                    state.hover?.matches(":hover") ||
                    state.pointerInsideHover ||
                    state.pointerInsideCard
                ) {
                    ensureMediaPlaying(
                        state
                    );

                    return;
                }

                closeState(state);

            }, BRIDGE_HOLD_DELAY);
    }

    function scheduleClose(
        state,
        delay = CLOSE_DELAY
    ) {
        clearTimeout(
            state.closeTimer
        );

        state.closeTimer =
            setTimeout(() => {
                if (
                    state !== activeState ||
                    !state.isOpen
                ) {
                    return;
                }

                const realHoverState =
                    getVisibleHoverStateAtPoint(
                        lastPointerX,
                        lastPointerY
                    );

                if (
                    realHoverState === state
                ) {
                    clearTimeout(
                        state.closeTimer
                    );

                    state.pointerInsideHover =
                        true;

                    ensureMediaPlaying(
                        state
                    );

                    return;
                }

                if (
                    state.pointerInsideCard ||
                    state.pointerInsideHover ||
                    state.hover?.matches(":hover") ||
                    isPointerInCardHoverBridge(state)
                ) {
                    ensureMediaPlaying(
                        state
                    );

                    return;
                }

                closeState(state);

            }, delay);
    }

    /* =========================
       HEADER LAYER
    ========================== */

    const HEADER_SELECTORS = [
        ".skinHeader",
        ".skinHeader-withBackground",
        ".skinHeader-blurred"
    ];

    function getActiveHeaderRect() {

        for (const selector of HEADER_SELECTORS) {
            const header =
                document.querySelector(selector);

            if (!header) {
                continue;
            }

            const style =
                window.getComputedStyle(header);

            if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                style.opacity === "0"
            ) {
                continue;
            }

            const rect =
                header.getBoundingClientRect();

            if (
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom > 0 &&
                rect.top < window.innerHeight
            ) {
                return rect;
            }
        }

        return null;
    }

    function getHeaderBottomLimit() {

        const rect =
            getActiveHeaderRect();

        if (!rect) {
            return 0;
        }

        return Math.max(
            0,
            rect.bottom
        );
    }

    function isPointInsideHeader(x, y) {

        const rect =
            getActiveHeaderRect();

        if (!rect) {
            return false;
        }

        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    function isCardHiddenByHeader(card) {

        if (!card) {
            return false;
        }

        const headerBottom =
            getHeaderBottomLimit();

        if (headerBottom <= 0) {
            return false;
        }

        const rect =
            card.getBoundingClientRect();

        /*
           Si le centre vertical de la card est sous le header,
           on considère que l'utilisateur est en train de pointer
           une card située derrière le header.
        */
        const cardCenterY =
            rect.top +
            rect.height / 2;

        return cardCenterY <= headerBottom;
    }

    /* =========================
       POSITION
    ========================== */

    function getHoverWidth(card) {
        const isContinueWatching =
            card.closest(
                '.resumeSection, [data-jf-section="0"]'
            );

        const laptop =
            window.innerWidth <= 1450;

        const mobile =
            window.innerWidth <= 900;

        if (mobile) {
            return 320;
        }

        if (isContinueWatching) {
            return laptop ? 350 : 390;
        }

        return laptop ? 390 : 440;
    }

    function positionHover(state) {
        if (
            !state ||
            !state.card ||
            !document.body.contains(
                state.card
            )
        ) {
            closeState(state);
            return;
        }

        const rect =
            state.card.getBoundingClientRect();

        if (
            rect.bottom < 0 ||
            rect.top > window.innerHeight
        ) {
            closeState(state);
            return;
        }

        const width =
            getHoverWidth(state.card);

        state.hover.style.width =
            `${width}px`;

        let left =
            rect.left +
            rect.width / 2 -
            width / 2;

        let top =
            rect.top - 10;

        left = Math.max(
            12,
            Math.min(
                left,
                window.innerWidth -
                width -
                12
            )
        );

        state.hover.style.position =
            "fixed";

        state.hover.style.left =
            `${left}px`;

        state.hover.style.top =
            `${top}px`;
    }

    function updateActivePosition() {
        if (
            !activeState ||
            !activeState.isOpen ||
            !activeState.card ||
            !activeState.hover ||
            !activeState.hover.classList.contains(
                "jf-hover-visible"
            )
        ) {
            return;
        }

        /*
           Le hover reste attaché à sa card d'origine.
           Même si le curseur est dessus, on ne le positionne
           jamais par rapport au curseur.
        */

        positionHover(
            activeState
        );
    }

    /* =========================
       SAFE ZONE CARD ↔ HOVER
    ========================== */

    function isPointerInRect(x, y, rect) {
        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    function isPointerInCardHoverBridge(state) {
        if (
            !state ||
            !state.card ||
            !state.hover ||
            !document.body.contains(
                state.card
            ) ||
            !document.body.contains(
                state.hover
            )
        ) {
            return false;
        }

        const cardRect =
            state.card.getBoundingClientRect();

        const hoverRect =
            state.hover.getBoundingClientRect();

        const horizontalMargin =
            HOVER_SAFE_MARGIN + 40;

        const verticalMargin =
            48;

        const expandedHoverRect = {
            left:
                hoverRect.left -
                horizontalMargin,

            right:
                hoverRect.right +
                horizontalMargin,

            top:
                hoverRect.top -
                verticalMargin,

            bottom:
                hoverRect.bottom +
                verticalMargin
        };

        const expandedCardRect = {
            left:
                cardRect.left -
                horizontalMargin,

            right:
                cardRect.right +
                horizontalMargin,

            top:
                cardRect.top -
                verticalMargin,

            bottom:
                cardRect.bottom +
                verticalMargin
        };

        if (
            isPointerInRect(
                lastPointerX,
                lastPointerY,
                expandedHoverRect
            )
        ) {
            return true;
        }

        if (
            isPointerInRect(
                lastPointerX,
                lastPointerY,
                expandedCardRect
            )
        ) {
            return true;
        }

        const bridgeRect = {
            left:
                Math.min(
                    cardRect.left,
                    hoverRect.left
                ) -
                horizontalMargin,

            right:
                Math.max(
                    cardRect.right,
                    hoverRect.right
                ) +
                horizontalMargin,

            top:
                Math.min(
                    cardRect.top,
                    hoverRect.top
                ) -
                18,

            bottom:
                Math.max(
                    cardRect.bottom,
                    hoverRect.bottom
                ) +
                18
        };

        return isPointerInRect(
            lastPointerX,
            lastPointerY,
            bridgeRect
        );
    }

    /* =========================
       POINTER DETECTION
    ========================== */


    /* =========================
       BLOCKING UI / DRAWERS
    ========================== */

    const BLOCKING_UI_SELECTORS = [
        "[aria-modal='true']",
        "[role='dialog']",
        ".MuiModal-root",
        ".MuiDrawer-root",
        ".MuiDialog-root",
        ".MuiPopover-root",
        ".dialog",
        ".dialogBackdrop",
        ".actionSheet",
        ".actionSheetContent",
        ".mainDrawer.open",
        ".mainDrawer.drawer-open",
        ".mainDrawer[aria-hidden='false']",
        ".drawer.open",
        ".drawer-open",
        ".sidebar.open",
        ".sideBar.open",
        ".sidePanel.open",
        ".rightSidebar",
        ".right-sidebar",
        ".rightDrawer",
        ".right-drawer",
        ".nowPlayingBar",
        ".nowPlayingQueue",
        ".playlistPanel"
    ];

    let blockingUiCacheAt =
        0;

    let blockingUiCacheValue =
        false;

    function isVisibleForHoverBlock(el) {

        if (
            !el ||
            el === document.documentElement ||
            el === document.body
        ) {
            return false;
        }

        if (
            el.closest &&
            el.closest(".jf-hoverTrailer")
        ) {
            return false;
        }

        const style =
            window.getComputedStyle(el);

        if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0" ||
            style.pointerEvents === "none"
        ) {
            return false;
        }

        const rect =
            el.getBoundingClientRect();

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight
        );
    }

    function getNumericZIndex(el) {

        const value =
            window.getComputedStyle(el).zIndex;

        const parsed =
            Number.parseInt(value, 10);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    }

    function getElementSignature(el) {

        return [
            el.id || "",
            typeof el.className === "string"
                ? el.className
                : "",
            el.getAttribute?.("role") || "",
            el.getAttribute?.("aria-label") || "",
            el.getAttribute?.("data-testid") || ""
        ]
            .join(" ")
            .toLowerCase();
    }

    function matchesKnownBlockingSelector(el) {

        return BLOCKING_UI_SELECTORS.some(selector => {
            try {
                return (
                    el.matches?.(selector) ||
                    el.closest?.(selector)
                );
            } catch {
                return false;
            }
        });
    }

    function isPotentialBlockingUiElement(el) {

        if (!isVisibleForHoverBlock(el)) {
            return false;
        }

        const signature =
            getElementSignature(el);

        if (
            matchesKnownBlockingSelector(el) ||
            signature.includes("drawer") ||
            signature.includes("dialog") ||
            signature.includes("modal") ||
            signature.includes("popover") ||
            signature.includes("overlay") ||
            signature.includes("sidebar") ||
            signature.includes("sidepanel") ||
            signature.includes("side-panel") ||
            signature.includes("rightdrawer") ||
            signature.includes("right-drawer") ||
            signature.includes("queue") ||
            signature.includes("nowplaying")
        ) {
            return true;
        }

        const style =
            window.getComputedStyle(el);

        const rect =
            el.getBoundingClientRect();

        const zIndex =
            getNumericZIndex(el);

        const isPositionedLayer =
            (
                style.position === "fixed" ||
                style.position === "sticky" ||
                (
                    style.position === "absolute" &&
                    zIndex >= 1000
                )
            );

        if (!isPositionedLayer) {
            return false;
        }

        const isHighEnough =
            zIndex >= 1000;

        const isSideLayer =
            rect.width >= 180 &&
            rect.height >= window.innerHeight * 0.35 &&
            (
                rect.right >= window.innerWidth - 8 ||
                rect.left <= 8
            );

        const isLargeOverlay =
            rect.width >= window.innerWidth * 0.35 &&
            rect.height >= window.innerHeight * 0.35;

        return (
            isHighEnough &&
            (
                isSideLayer ||
                isLargeOverlay
            )
        );
    }

    function isPointerBlockedByTopUi(x, y) {

        const elements =
            document.elementsFromPoint(
                x,
                y
            );

        if (
            elements.some(el =>
                el.closest &&
                el.closest(".jf-hoverTrailer.jf-hover-visible")
            )
        ) {
            return false;
        }

        for (const el of elements) {

            if (
                el.closest &&
                el.closest(".jf-hoverTrailer")
            ) {
                continue;
            }

            if (
                isPotentialBlockingUiElement(el)
            ) {
                return true;
            }

            const card =
                el.closest &&
                el.closest('.card[data-type="Movie"], .card[data-type="Series"]');

            if (card) {
                return false;
            }
        }

        return false;
    }

    function hasOpenBlockingUiLayer() {

        const now =
            Date.now();

        if (
            now - blockingUiCacheAt <
            250
        ) {
            return blockingUiCacheValue;
        }

        blockingUiCacheAt =
            now;

        blockingUiCacheValue =
            false;

        const directCandidates =
            document.querySelectorAll(
                BLOCKING_UI_SELECTORS.join(",")
            );

        for (const el of directCandidates) {
            if (
                isPotentialBlockingUiElement(el)
            ) {
                blockingUiCacheValue =
                    true;

                return true;
            }
        }

        return false;
    }

    function isPointerOverVisibleHover(x, y) {

        const elements =
            document.elementsFromPoint(
                x,
                y
            );

        return elements.some(el =>
            el.closest &&
            el.closest(".jf-hoverTrailer.jf-hover-visible")
        );
    }

    function isHoverInteractionBlocked(x, y) {

        /*
           Important :
           si le pointeur est déjà sur le hover visible,
           on ne doit jamais interpréter le hover lui-même
           comme un drawer, une modale ou une UI bloquante.
        */
        if (
            isPointerOverVisibleHover(
                x,
                y
            )
        ) {
            return false;
        }

        /*
           On bloque seulement si l'élément réellement sous
           le pointeur est une UI supérieure : drawer, panel,
           modal, popover, etc.

           On n'utilise plus hasOpenBlockingUiLayer() ici,
           car cela bloquait les mouvements sur le hover dès
           qu'un panneau était ouvert ailleurs sur la page.
        */
        return isPointerBlockedByTopUi(
            x,
            y
        );
    }

    function stopHoverForBlockingUi() {

        clearTimeout(
            globalOpenTimer
        );

        clearBridgeHold();

        if (activeState) {
            closeState(
                activeState
            );
        }
    }

    function getMovieCardAtPoint(x, y) {

        if (
            isHoverInteractionBlocked(
                x,
                y
            )
        ) {
            return null;
        }

        const elements =
            document.elementsFromPoint(
                x,
                y
            );

        for (const el of elements) {
            if (
                el.closest &&
                el.closest(
                    ".jf-hoverTrailer"
                )
            ) {
                continue;
            }

            const card =
                el.closest &&
                el.closest(
                    '.card[data-type="Movie"], .card[data-type="Series"]'
                );

            if (
                card &&
                document.body.contains(card)
            ) {
                return card;
            }
        }

        return null;
    }

    function getVisibleHoverStateAtPoint(x, y) {
        const elements =
            document.elementsFromPoint(
                x,
                y
            );

        for (const el of elements) {
            const hover =
                el.closest &&
                el.closest(
                    ".jf-hoverTrailer.jf-hover-visible"
                );

            if (!hover) {
                continue;
            }

            const state =
                stateByHover.get(hover);

            if (
                state &&
                state.hover === hover &&
                document.body.contains(hover)
            ) {
                return state;
            }
        }

        return null;
    }

    function handlePointerMove(event) {

        const pointerHoverState =
            getVisibleHoverStateAtPoint(
                event.clientX,
                event.clientY
            );

        if (pointerHoverState) {
            clearBridgeHold();

            if (
                activeState &&
                activeState !== pointerHoverState
            ) {
                activeState.pointerInsideHover =
                    false;

                activeState.pointerInsideCard =
                    false;
            }

            activeState =
                pointerHoverState;

            pointerHoverState.pointerInsideHover =
                true;

            pointerHoverState.pointerInsideCard =
                false;

            clearTimeout(
                pointerHoverState.closeTimer
            );

            ensureMediaPlaying(
                pointerHoverState
            );

            return;
        }

        if (
            isHoverInteractionBlocked(
                event.clientX,
                event.clientY
            )
        ) {
            lastPointerX =
                event.clientX;

            lastPointerY =
                event.clientY;

            stopHoverForBlockingUi();
            return;
        }

        lastPointerX =
            event.clientX;

        lastPointerY =
            event.clientY;

        if (
            isScrolling &&
            activeState &&
            activeState.isOpen
        ) {
            /*
               Pendant le scroll, on ne laisse pas le pointeur
               changer de card active ni réinterpréter le hover.
               Le hover reste lié à sa card d'origine.
            */

            updateActivePosition();

            return;
        }

        const hoverState =
            getVisibleHoverStateAtPoint(
                lastPointerX,
                lastPointerY
            );

        if (hoverState) {
            clearBridgeHold();

            if (
                activeState &&
                activeState !== hoverState
            ) {
                activeState.pointerInsideHover =
                    false;

                activeState.pointerInsideCard =
                    false;
            }

            activeState =
                hoverState;

            hoverState.pointerInsideHover =
                true;

            hoverState.pointerInsideCard =
                false;

            clearTimeout(
                hoverState.closeTimer
            );

            ensureMediaPlaying(
                hoverState
            );

            return;
        }

        const card =
            getMovieCardAtPoint(
                event.clientX,
                event.clientY
            );

        if (card) {
            clearBridgeHold();

            const state =
                getState(card);

            state.pointerInsideCard =
                true;

            state.pointerInsideHover =
                false;

            if (
                activeState &&
                activeState !== state
            ) {
                activeState.pointerInsideCard =
                    false;

                activeState.pointerInsideHover =
                    false;
            }

            if (
                activeState !== state ||
                !state.isOpen
            ) {
                clearTimeout(
                    globalOpenTimer
                );

                closeAllExcept(state);

                globalOpenTimer =
                    setTimeout(() => {
                        showHover(card);
                    }, OPEN_DELAY);
            }

            return;
        }

        if (activeState) {
            activeState.pointerInsideCard =
                false;

            activeState.pointerInsideHover =
                false;

            if (
                isPointerInCardHoverBridge(
                    activeState
                )
            ) {
                clearTimeout(
                    activeState.closeTimer
                );

                ensureMediaPlaying(
                    activeState
                );

                scheduleBridgeHoldClose(
                    activeState
                );

                return;
            }

            clearBridgeHold();

            scheduleClose(
                activeState,
                CLOSE_DELAY
            );
        }
    }

    on(
        document,
        "pointermove",
        event => {
            lastPointerEvent = event;

            if (pointerRaf) {
                return;
            }

            pointerRaf =
                requestAnimationFrame(() => {
                    pointerRaf = null;

                    if (lastPointerEvent) {
                        handlePointerMove(
                            lastPointerEvent
                        );
                    }
                });

        },
        {
            passive: true,
            capture: true
        }
    );

    on(
        document,
        "click",
        event => {
            const insideHover =
                event.target.closest &&
                event.target.closest(
                    ".jf-hoverTrailer"
                );

            if (insideHover) {
                return;
            }

            destroyAllHovers();

        },
        {
            capture: true
        }
    );

    /* =========================
       TRAILER SELECTOR
    ========================== */

    function selectTrailer(trailers) {
        if (
            !trailers ||
            !trailers.length
        ) {
            return null;
        }

        const getFileName =
            trailer => {
                if (!trailer.Path)
                    return "";

                return trailer.Path
                    .split("/")
                    .pop()
                    .toLowerCase();
            };

        return (
            trailers.find(
                t =>
                    getFileName(t) ===
                    "trailer2_hover.mp4"
            ) ||
            trailers.find(
                t =>
                    getFileName(t) ===
                    "trailer1_hover.mp4"
            ) ||
            trailers[0]
        );
    }

    function getTrailerUrl(trailer) {
        if (!trailer)
            return null;

        const params = {
            static: true,
            mediaSourceId: trailer.Id
        };

        if (
            window.ApiClient &&
            typeof window.ApiClient.getUrl ===
                "function"
        ) {
            return window.ApiClient.getUrl(
                `Videos/${trailer.Id}/stream.mp4`,
                params
            );
        }

        const search =
            new URLSearchParams(
                params
            );

        return (
            `/Videos/${trailer.Id}/stream.mp4?` +
            search.toString()
        );
    }

    async function getLocalTrailerUrl(item) {
        if (!ENABLE_LOCAL_TRAILERS)
            return null;

        const itemId =
            item?.Id || "";

        const hasCachedTrailers =
            itemId &&
            trailerCache.has(itemId);

        if (
            !hasCachedTrailers &&
            LOCAL_TRAILER_COOLDOWN_MS > 0
        ) {
            const now =
                Date.now();

            if (
                now - lastLocalTrailerLookupAt <
                LOCAL_TRAILER_COOLDOWN_MS
            ) {
                if (DEBUG_HOVER) {
                    console.log(
                        "[CinemaHover] Local trailer cooldown, using backdrop",
                        {
                            itemId,
                            cooldown: LOCAL_TRAILER_COOLDOWN_MS
                        }
                    );
                }

                return null;
            }

            lastLocalTrailerLookupAt =
                now;
        }

        try {
            const trailers =
                await getCachedLocalTrailers(
                    item.Id
                );

            const trailer =
                selectTrailer(
                    trailers
                );

            return getTrailerUrl(
                trailer
            );

        } catch (e) {
            if (DEBUG_HOVER) {
                console.log(
                    "Local trailer error",
                    e
                );
            }

            return null;
        }
    }

    /* =========================
       OPEN ITEM
    ========================== */

    function openStateItem(state) {
        if (!state?.href)
            return;

        const rawHref =
            state.href.trim();

        if (
            !isSafeJellyfinHref(
                rawHref
            )
        ) {
            return;
        }

        const href =
            rawHref.replace(/^#/, "");

        destroyAllHovers();

        requestAnimationFrame(() => {
            window.location.hash =
                href;
        });
    }

    /* =========================
       BUILD CONTENT
    ========================== */

    async function ensureContent(state) {
        if (state.loaded) {
            return true;
        }

        if (state.loading) {
            return state.loading;
        }

        state.loading =
            (async () => {
                try {
                    const card =
                        state.card;

                    const itemId =
                        card.dataset.id;

                    if (!itemId)
                        return false;

                    const link =
                        card.querySelector(
                            ".cardImageContainer"
                        );

                    state.href =
                        link?.getAttribute("href") ||
                        null;

                    const item =
                        await getCachedItem(
                            itemId
                        );

                    if (!item)
                        return false;

                    state.item =
                        item;

                    const backdrop =
                        item.BackdropImageTags?.[0]
                            ? window.ApiClient.getImageUrl(
                                item.Id,
                                {
                                    type: "Backdrop",
                                    tag:
                                        item.BackdropImageTags[0]
                                }
                            )
                            : "";

                    let localTrailerUrl = null;
                    let youtubeUrl = "";

                    if (PREFER_LOCAL_TRAILERS) {
                        localTrailerUrl =
                            await getLocalTrailerUrl(item);

                        if (
                            !localTrailerUrl &&
                            ENABLE_YOUTUBE_TRAILERS
                        ) {
                            const youtubeId =
                                getYouTubeTrailerId(item);

                            youtubeUrl =
                                getYouTubeEmbedUrl(
                                    youtubeId
                                );
                        }

                    } else {
                        if (ENABLE_YOUTUBE_TRAILERS) {
                            const youtubeId =
                                getYouTubeTrailerId(item);

                            youtubeUrl =
                                getYouTubeEmbedUrl(
                                    youtubeId
                                );
                        }

                        if (
                            !youtubeUrl &&
                            ENABLE_LOCAL_TRAILERS
                        ) {
                            localTrailerUrl =
                                await getLocalTrailerUrl(item);
                        }
                    }

                    const mediaType =
                        localTrailerUrl
                            ? "local"
                            : youtubeUrl
                                ? "youtube"
                                : "backdrop";

                    const director =
                        item.People?.find(
                            p =>
                                p.Type ===
                                "Director"
                        )?.Name || "";

                    const runtime =
                        item.RunTimeTicks
                            ? Math.floor(
                                item.RunTimeTicks /
                                600000000
                            ) + " min"
                            : "";

                    const languages =
                        getLanguages(item);

                    const flags =
                        getCountryFlags(item);

                    state.hover.innerHTML = `

                        <div class="jf-hover-inner">

                            <div class="jf-hover-media">

                                ${
                                    mediaType === "local"
                                        ? `
                                        <video
                                            class="jf-hover-video"
                                            autoplay
                                            muted
                                            loop
                                            playsinline
                                            preload="${escapeHtml(VIDEO_PRELOAD_MODE)}"
                                            poster="${escapeHtml(backdrop)}"
                                            data-src="${escapeHtml(localTrailerUrl)}"
                                        ></video>

                                        <button
                                            class="jf-hover-sound"
                                            type="button"
                                            aria-label="${escapeHtml(ht("soundToggle"))}"
                                        >
                                            <span class="jf-hover-sound-icon">
                                                🔇
                                            </span>
                                        </button>
                                        `
                                        : mediaType === "youtube"
                                            ? `
                                            <div class="jf-hover-youtube-wrap">

                                                <iframe
                                                    class="jf-hover-youtube"
                                                    data-src="${escapeHtml(youtubeUrl)}"
                                                    src="${escapeHtml(youtubeUrl)}"
                                                    title="Trailer YouTube"
                                                    allow="autoplay; encrypted-media; picture-in-picture"
                                                    referrerpolicy="strict-origin-when-cross-origin"
                                                    loading="eager"
                                                ></iframe>

                                                <div class="jf-hover-youtube-cover"></div>

                                                <button
                                                    class="jf-hover-sound jf-hover-sound-youtube"
                                                    type="button"
                                                    aria-label="${escapeHtml(ht("soundToggle"))}"
                                                >
                                                    <span class="jf-hover-sound-icon">
                                                        🔇
                                                    </span>
                                                </button>

                                            </div>
                                            `
                                            : `
                                            <div
                                                class="jf-hover-backdrop"
                                            ></div>
                                            `
                                }

                            </div>

                            <div class="jf-hover-content">

                                <div class="jf-hover-title">
                                    ${escapeHtml(item.Name || "")}
                                </div>

                                ${
                                    director
                                        ? `
                                        <div class="jf-hover-director">
                                            ${escapeHtml(ht("directedBy"))} ${escapeHtml(director)}
                                        </div>
                                        `
                                        : ""
                                }

                                <div class="jf-hover-description">
                                    ${escapeHtml(item.Overview || "")}
                                </div>

                                <div class="jf-hover-meta">

                                    ${
                                        flags
                                            ? `
                                            <span class="jf-hover-flags">
                                                ${flags}
                                            </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        runtime
                                            ? `
                                            <span>
                                                ${escapeHtml(runtime)}
                                            </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        item.ProductionYear
                                            ? `
                                            <span>
                                                ${escapeHtml(item.ProductionYear)}
                                            </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        languages
                                            ? `
                                            <span>
                                                ${escapeHtml(languages)}
                                            </span>
                                            `
                                            : ""
                                    }

                                </div>

                            </div>

                        </div>

                    `;

                    const backdropEl =
                        state.hover.querySelector(
                            ".jf-hover-backdrop"
                        );

                    if (
                        backdropEl &&
                        backdrop
                    ) {
                        if (isSafeHoverImageUrl(backdrop)) {
                            backdropEl.style.backgroundImage =
                                `url("${backdrop}")`;
                        }
                    }

                    bindHoverEvents(state);

                    state.video =
                        state.hover.querySelector(
                            ".jf-hover-video"
                        );

                    state.youtubeFrame =
                        state.hover.querySelector(
                            ".jf-hover-youtube"
                        );

                    state.loaded = true;

                    return true;

                } catch (e) {
                    if (DEBUG_HOVER) {
                        console.log(
                            "Hover build error",
                            e
                        );
                    }

                    return false;

                } finally {
                    state.loading = null;
                }
            })();

        return state.loading;
    }

    function bindHoverEvents(state) {
        on(
            state.hover,
            "click",
            e => {
                if (
                    e.target.closest &&
                    e.target.closest(
                        ".jf-hover-sound"
                    )
                ) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                openStateItem(state);

            },
            true
        );

        const soundButton =
            state.hover.querySelector(
                ".jf-hover-sound"
            );

        const video =
            state.hover.querySelector(
                ".jf-hover-video"
            );

        const youtubeFrame =
            state.hover.querySelector(
                ".jf-hover-youtube"
            );

        if (soundButton) {
            [
                "pointerdown",
                "mousedown",
                "mouseup",
                "click"
            ].forEach(type => {
                on(
                    soundButton,
                    type,
                    e => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (type !== "click")
                            return;

                        const soundIcon =
                            soundButton.querySelector(
                                ".jf-hover-sound-icon"
                            );

                        if (video) {
                            if (video.muted) {
                                video.muted = false;
                                video.volume = 1;

                                video.play()
                                    .catch(() => {});

                                if (soundIcon) {
                                    soundIcon.textContent =
                                        "🔊";
                                }

                            } else {
                                video.muted = true;

                                if (soundIcon) {
                                    soundIcon.textContent =
                                        "🔇";
                                }
                            }

                            return;
                        }

                        if (youtubeFrame) {
                            state.youtubeFrame =
                                youtubeFrame;

                            const nextMuted =
                                state.youtubeMuted !== false
                                    ? false
                                    : true;

                            setYouTubeMuted(
                                state,
                                nextMuted
                            );
                        }

                    },
                    true
                );
            });
        }
    }

    async function showHover(card) {

        if (shouldDisableCinemaHoverRuntime()) {
            disableCinemaHoverRuntime("showHover");
            return;
        }

        if (
            isHoverInteractionBlocked(
                lastPointerX,
                lastPointerY
            )
        ) {
            stopHoverForBlockingUi();
            return;
        }

        const loadToken =
            ++globalLoadToken;

        const state =
            getState(card);

        closeAllExcept(state);

        activeState = state;

        state.requestId++;

        const requestId =
            state.requestId;

        clearTimeout(globalOpenTimer);
        clearTimeout(state.closeTimer);
        clearTimeout(state.youtubeRevealTimer);

        clearBridgeHold();

        resetMediaState(state);

        positionHover(state);

        const ok =
            await ensureContent(state);

        if (
            loadToken !== globalLoadToken ||
            !ok ||
            activeState !== state ||
            requestId !== state.requestId
        ) {
            return;
        }

        positionHover(state);

        requestAnimationFrame(() => {
            if (
                activeState !== state ||
                requestId !== state.requestId
            ) {
                return;
            }

            state.isOpen = true;

            state.hover.classList.add(
                "jf-hover-visible"
            );

            state.video =
                state.hover.querySelector(
                    ".jf-hover-video"
                );

            state.youtubeFrame =
                state.hover.querySelector(
                    ".jf-hover-youtube"
                );

            if (state.video) {
                const soundIcon =
                    state.hover.querySelector(
                        ".jf-hover-sound-icon"
                    );

                state.video.muted = true;
                state.video.volume = 1;

                try {
                    state.video.currentTime = 0;
                } catch {}

                if (soundIcon) {
                    soundIcon.textContent =
                        "🔇";
                }

                ensureVideoPlaying(
                    state
                );
            }

            if (state.youtubeFrame) {
                state.youtubeMuted = true;

                const soundIcon =
                    state.hover.querySelector(
                        ".jf-hover-sound-icon"
                    );

                if (soundIcon) {
                    soundIcon.textContent =
                        "🔇";
                }

                const src =
                    state.youtubeFrame.dataset.src || "";

                state.youtubeFrame.classList.remove(
                    "jf-hover-youtube-ready"
                );

                if (src) {
                    state.youtubeFrame.src =
                        src;
                }

                clearTimeout(
                    state.youtubeRevealTimer
                );

                state.youtubeRevealTimer =
                    setTimeout(() => {
                        if (
                            state.youtubeFrame &&
                            state.isOpen
                        ) {
                            state.youtubeFrame.classList.add(
                                "jf-hover-youtube-ready"
                            );

                            sendYouTubeCommand(
                                state,
                                "playVideo"
                            );

                            setYouTubeMuted(
                                state,
                                true
                            );
                        }

                    }, YOUTUBE_REVEAL_DELAY);
            }

            requestAnimationFrame(() => {
                if (activeState === state) {
                    positionHover(state);
                }
            });
        });
    }

    function scheduleBindCards() {
        if (shouldDisableCinemaHoverRuntime()) {
            disableCinemaHoverRuntime("scheduleBindCards");
            return;
        }

        bindCards();

        setTimeout(
            bindCards,
            250
        );

        setTimeout(
            bindCards,
            800
        );

        setTimeout(
            bindCards,
            2000
        );

        setTimeout(
            bindCards,
            5000
        );
    }

    function bindCards() {
        if (shouldDisableCinemaHoverRuntime()) {
            disableCinemaHoverRuntime("bindCards");
            return;
        }

        if (!PLUGIN_CONFIG_LOADED) {
            if (DEBUG_HOVER) {
                console.log(
                    "[CinemaHover] bindCards skipped: config not loaded"
                );
            }

            return;
        }

        cleanupDisconnectedStates();

        const cards =
            document.querySelectorAll(
                '.card[data-type="Movie"]:not([data-hoverBound]), .card[data-type="Series"]:not([data-hoverBound]), .card[data-type="Series"]:not([data-hoverBound])'
            );

        cards.forEach(card => {
            card.dataset.hoverBound =
                "true";

            on(
                card,
                "mouseenter",
                event => {
                    if (shouldDisableCinemaHoverRuntime()) {
                        disableCinemaHoverRuntime("mouseenter");
                        return;
                    }

                    lastPointerX =
                        event.clientX;

                    lastPointerY =
                        event.clientY;

                    if (
                        isHoverInteractionBlocked(
                            lastPointerX,
                            lastPointerY
                        )
                    ) {
                        stopHoverForBlockingUi();
                        return;
                    }


                    clearTimeout(
                        globalOpenTimer
                    );

                    clearBridgeHold();

                    const state =
                        getState(card);

                    state.pointerInsideCard =
                        true;

                    state.pointerInsideHover =
                        false;

                    closeAllExcept(state);

                    globalOpenTimer =
                        setTimeout(() => {
                            showHover(card);
                        }, OPEN_DELAY);
                }
            );

            on(
                card,
                "mouseleave",
                event => {
                    clearTimeout(
                        globalOpenTimer
                    );

                    lastPointerX =
                        event.clientX;

                    lastPointerY =
                        event.clientY;

                    const state =
                        getState(card);

                    state.pointerInsideCard =
                        false;

                    scheduleClose(
                        state,
                        CARD_TO_HOVER_GRACE
                    );
                }
            );
        });
    }

    /* =========================
       GLOBAL EVENTS
    ========================== */

    on(
        window,
        "scroll",
        () => {
            isScrolling = true;

            clearTimeout(
                scrollUnlockTimer
            );

            scrollUnlockTimer =
                setTimeout(() => {
                    isScrolling = false;
                }, SCROLL_POINTER_LOCK_DELAY);

            if (scrollRaf) {
                return;
            }

            scrollRaf =
                requestAnimationFrame(() => {
                    scrollRaf = null;

                    /*
                       Le hover reste ouvert et reste
                       attaché à sa card d'origine.
                    */

                    updateActivePosition();
                });

        },
        { passive: true }
    );

    on(
        window,
        "resize",
        () => {
            destroyAllHovers();

            if (shouldDisableCinemaHoverRuntime()) {
                disableCinemaHoverRuntime("resize");
            }
        }
    );

    on(
        window,
        "hashchange",
        () => {
            destroyAllHovers();
        }
    );

    on(
        window,
        "popstate",
        () => {
            destroyAllHovers();
        }
    );

    on(
        document,
        "visibilitychange",
        () => {
            if (document.hidden) {
                destroyAllHovers();
            }
        }
    );

    const observer =
        new MutationObserver(() => {
            if (PLUGIN_CONFIG_LOADED) {
                if (shouldDisableCinemaHoverRuntime()) {
                    disableCinemaHoverRuntime("mutation");
                    return;
                }

                bindCards();
            }
        });

if (false) {
    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
}

    JF_HOVER_SIGNAL.addEventListener(
        "abort",
        () => {
            try {
                observer.disconnect();
            } catch {}

            destroyAllHovers();

            const style =
                document.getElementById(
                    "jf-hover-trailer-style"
                );

            if (style) {
                style.remove();
            }
        },
        { once: true }
    );

    async function bootCinemaHover() {

        await waitForCinemaHoverRuntime();
        await loadCinemaHoverPluginConfig();

        if (shouldDisableCinemaHoverRuntime()) {
            disableCinemaHoverRuntime("boot");
            return;
        }

        scheduleBindCards();
    }

    window.CinemaHoverRuntimeDebug = function () {
        return {
            pluginEnabled: PLUGIN_ENABLED,
            disableOnTouchDevices: DISABLE_ON_TOUCH_DEVICES,
            disableUnderWidth: DISABLE_UNDER_WIDTH,
            touch: isTouchDevice(),
            mobileLayout: isMobileLayout(),
            innerWidth: window.innerWidth,
            disabled: shouldDisableCinemaHoverRuntime(),
            hoverBound: document.querySelectorAll("[data-hoverBound]").length,
            hoverPanels: document.querySelectorAll(".jf-hoverTrailer").length,
            visibleHoverPanels: document.querySelectorAll(".jf-hoverTrailer.jf-hover-visible").length
        };
    };

    bootCinemaHover();

    window.addEventListener(
        "hashchange",
        () => {
            if (DEBUG_HOVER) {
                console.log(
                    "[CinemaHover] schedule bind after hashchange"
                );
            }

            setTimeout(
                scheduleBindCards,
                800
            );
        },
        { passive: true }
    );

    window.addEventListener(
        "hashchange",
        () => {
            if (DEBUG_HOVER) {
                console.log(
                    "[CinemaHover] schedule bind after hashchange"
                );
            }

            setTimeout(
                scheduleBindCards,
                800
            );
        },
        { passive: true }
    );

    /* =========================
       CSS
    ========================== */

    const style =
        document.createElement("style");

    style.id =
        "jf-hover-trailer-style";

    style.textContent = `

        .jf-hoverTrailer{

            position:fixed !important;

            z-index:900 !important;

            opacity:0;

            pointer-events:none;

            cursor:pointer;

            transform:
                scale(.94)
                translateY(14px);

            transition:
                opacity .16s ease,
                transform .22s cubic-bezier(.2,.9,.2,1);

            border-radius:12px;

            overflow:hidden;

            background:#ffffff;

            box-shadow:
                0 28px 70px rgba(0,0,0,.45);

            isolation:isolate;

            will-change:
                transform,
                opacity;
        }

        .jf-hover-visible{

            opacity:1;

            pointer-events:auto;

            transform:
                scale(1)
                translateY(0);
        }

        .jf-hover-inner{

            position:relative;

            background:#ffffff;
        }

        .jf-hover-media{

            position:relative;

            z-index:2;

            aspect-ratio:16/9;

            background:black;

            overflow:hidden;

            pointer-events:auto;
        }

        .jf-hover-video,
        .jf-hover-backdrop,
        .jf-hover-youtube{

            pointer-events:none;
        }

        .jf-hover-video{

            width:100%;

            height:100%;

            object-fit:cover;

            display:block;
        }

        .jf-hover-youtube-wrap{

            position:relative;

            width:100%;

            height:100%;

            background:#000;

            overflow:hidden;
        }

        .jf-hover-youtube{

            width:100%;

            height:100%;

            border:0;

            display:block;

            background:#000;

            opacity:0;

            transition:
                opacity .18s ease;

            pointer-events:none;
        }

        .jf-hover-youtube-ready{

            opacity:1;
        }

        .jf-hover-youtube-cover{

            position:absolute;

            left:0;

            right:0;

            bottom:0;

            height:58px;

            z-index:4;

            pointer-events:none;

            background:
                linear-gradient(
                    to top,
                    rgba(0,0,0,.92),
                    rgba(0,0,0,.45),
                    rgba(0,0,0,0)
                );
        }

        .jf-hover-backdrop{

            width:100%;

            height:100%;

            background-size:contain;

            background-repeat:no-repeat;

            background-position:center;

            background-color:#000;
        }

        .jf-hover-content{

            position:relative;

            z-index:2;

            padding:18px;

            pointer-events:auto;
        }

        .jf-hover-title{

            color:#111;

            font-size:1.2rem;

            font-weight:700;

            line-height:1.2;

            margin-bottom:6px;
        }

        .jf-hover-director{

            color:#4d4d4d;

            font-size:.95rem;

            margin-bottom:12px;
        }

        .jf-hover-description{

            color:#111;

            font-size:.93rem;

            line-height:1.5;

            display:-webkit-box;

            -webkit-line-clamp:3;

            -webkit-box-orient:vertical;

            overflow:hidden;

            max-height:4.5em;

            margin-bottom:12px;
        }

        .jf-hover-meta{

            display:flex;

            align-items:center;

            flex-wrap:wrap;

            gap:10px;

            color:#5f5f5f;

            font-size:.9rem;

            font-weight:600;
        }

        .jf-hover-flags{

            display:flex;

            align-items:center;

            gap:5px;
        }

        .jf-hover-flagBox{

            display:flex;

            align-items:center;

            justify-content:center;

            min-width:22px;

            min-height:16px;

            font-size:1.05rem;

            line-height:1;

            filter:
                drop-shadow(0 0 1px rgba(0,0,0,.18));
        }

        .jf-hover-sound{

            position:absolute;

            right:12px;

            bottom:12px;

            width:45px;

            height:45px;

            border:none;

            border-radius:50%;

            background:rgba(0,0,0,.45);

            display:flex;

            align-items:center;

            justify-content:center;

            padding:0;

            cursor:pointer;

            z-index:12;

            pointer-events:auto;

            backdrop-filter:blur(4px);

            font-family:
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                sans-serif;
        }

        .jf-hover-sound-youtube{

            z-index:12;
        }

        .jf-hover-sound:hover{

            background:rgba(0,0,0,.62);

            transform:scale(1.06);
        }

        .jf-hover-sound-icon{

            display:flex;

            align-items:center;

            justify-content:center;

            width:22.5px;

            height:22.5px;

            font-size:22.5px;

            line-height:1;

            pointer-events:none;
        }

        @media (max-width:1450px){

            .jf-hover-title{

                font-size:1.08rem;
            }

            .jf-hover-description{

                font-size:.9rem;
            }
        }

        @media (max-width:900px){

            .jf-hoverTrailer{

                border-radius:10px;
            }

            .jf-hover-content{

                padding:15px;
            }

            .jf-hover-title{

                font-size:1rem;
            }

            .jf-hover-description{

                font-size:.84rem;

                -webkit-line-clamp:3;
            }

            .jf-hover-meta{

                font-size:.8rem;
            }
        }

    `;

    document.head.appendChild(
        style
    );

})();