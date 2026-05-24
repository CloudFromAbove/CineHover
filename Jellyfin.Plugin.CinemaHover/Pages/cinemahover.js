(function () {
    "use strict";

    const PAGE_ID =
        "cinemaHoverConfigPage";

    const CONFIG_URL =
        "/CinemaHover/config";

    const I18N = {
        fr: {
            title: "Cinema Hover",

            tabs: {
                general: "Général",
                trailers: "Trailers",
                performance: "Performance",
                language: "Langue",
                advanced: "Avancé"
            },

            enabled: "Activer Cinema Hover",
            disableTouch: "Désactiver sur appareils tactiles",
            disableUnderWidth: "Désactiver sous cette largeur",
            disableUnderWidthHelp: "0 = jamais désactiver selon la largeur.",

            enableLocalTrailers: "Activer les trailers locaux",
            enableYouTubeTrailers: "Activer les trailers YouTube",
            preferLocalTrailers: "Priorité aux trailers locaux",
            videoPreloadMode: "Préchargement vidéo",

            openDelay: "Délai d’ouverture",
            closeDelay: "Délai de fermeture",
            cardToHoverGrace: "Tolérance card → hover",
            localTrailerCooldown: "Cooldown trailer local",
            youtubeRevealDelay: "Délai révélation YouTube",

            interfaceLanguage: "Langue de l’interface",
            nativeLanguage: "Langue native",
            nativeLanguageHelp: "Définit les badges du hover : VF/VOST/VO ou Dub/Sub/Original.",
            languageSeparator: "Séparateur des badges",

            hoverSafeMargin: "Marge de sécurité hover",
            bridgeHoldDelay: "Délai pont card-hover",
            hoverZIndex: "Z-index hover",
            debug: "Debug console",
            autoRegisterWithJavaScriptInjector: "Enregistrer automatiquement le loader via JavaScript Injector",
            autoRegisterWithJavaScriptInjectorHelp: "Si JavaScript Injector est installé, CinemaHover peut y enregistrer automatiquement son loader.",

            save: "Enregistrer",
            saved: "Configuration enregistrée"
        },

        en: {
            title: "Cinema Hover",

            tabs: {
                general: "General",
                trailers: "Trailers",
                performance: "Performance",
                language: "Language",
                advanced: "Advanced"
            },

            enabled: "Enable Cinema Hover",
            disableTouch: "Disable on touch devices",
            disableUnderWidth: "Disable below this width",
            disableUnderWidthHelp: "0 = never disable based on width.",

            enableLocalTrailers: "Enable local trailers",
            enableYouTubeTrailers: "Enable YouTube trailers",
            preferLocalTrailers: "Prefer local trailers",
            videoPreloadMode: "Video preload",

            openDelay: "Open delay",
            closeDelay: "Close delay",
            cardToHoverGrace: "Card → hover grace delay",
            localTrailerCooldown: "Local trailer cooldown",
            youtubeRevealDelay: "YouTube reveal delay",

            interfaceLanguage: "Interface language",
            nativeLanguage: "Native language",
            nativeLanguageHelp: "Controls hover badges: VF/VOST/VO or Dub/Sub/Original.",
            languageSeparator: "Badge separator",

            hoverSafeMargin: "Hover safe margin",
            bridgeHoldDelay: "Card-hover bridge delay",
            hoverZIndex: "Hover z-index",
            debug: "Console debug",
            autoRegisterWithJavaScriptInjector: "Automatically register the loader with JavaScript Injector",
            autoRegisterWithJavaScriptInjectorHelp: "If JavaScript Injector is installed, CinemaHover can automatically register its loader there.",

            save: "Save",
            saved: "Settings saved"
        }
    };

    function getPage() {
        return document.getElementById(
            PAGE_ID
        );
    }

    function getLang(config) {
        return config?.InterfaceLanguage === "en"
            ? "en"
            : "fr";
    }

    function getText(dict, key) {
        return key
            .split(".")
            .reduce(
                (value, part) => value?.[part],
                dict
            );
    }

    function applyLanguage(page, config) {
        const lang =
            getLang(config);

        const dict =
            I18N[lang];

        page
            .querySelectorAll("[data-i18n]")
            .forEach(el => {
                const key =
                    el.getAttribute("data-i18n");

                const value =
                    getText(dict, key);

                if (value) {
                    el.textContent =
                        value;
                }
            });
    }

    function setValue(page, id, value) {
        const el =
            page.querySelector(`#${id}`);

        if (!el) {
            return;
        }

        if (el.type === "checkbox") {
            el.checked =
                Boolean(value);

            return;
        }

        el.value =
            value ?? "";
    }

    function getBool(page, id) {
        return Boolean(
            page.querySelector(`#${id}`)?.checked
        );
    }

    function getString(page, id, fallback = "") {
        const value =
            page.querySelector(`#${id}`)?.value;

        return value ?? fallback;
    }

    function getNumber(page, id, fallback = 0) {
        const value =
            Number(
                page.querySelector(`#${id}`)?.value
            );

        return Number.isFinite(value)
            ? value
            : fallback;
    }

    async function loadConfig() {
        const response =
            await fetch(
                CONFIG_URL,
                {
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `Unable to load config: ${response.status}`
            );
        }

        return await response.json();
    }

    async function saveConfig(config) {
        const response =
            await fetch(
                CONFIG_URL,
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(config)
                }
            );

        if (!response.ok) {
            throw new Error(
                `Unable to save config: ${response.status}`
            );
        }
    }

    function fillForm(page, config) {
        setValue(page, "Enabled", config.Enabled);
        setValue(page, "DisableOnTouchDevices", config.DisableOnTouchDevices);
        setValue(page, "DisableUnderWidth", config.DisableUnderWidth);

        setValue(page, "EnableLocalTrailers", config.EnableLocalTrailers);
        setValue(page, "EnableYouTubeTrailers", config.EnableYouTubeTrailers);
        setValue(page, "PreferLocalTrailers", config.PreferLocalTrailers);
        setValue(page, "VideoPreloadMode", config.VideoPreloadMode || "none");

        setValue(page, "OpenDelay", config.OpenDelay);
        setValue(page, "CloseDelay", config.CloseDelay);
        setValue(page, "CardToHoverGrace", config.CardToHoverGrace);
        setValue(page, "LocalTrailerCooldownMs", config.LocalTrailerCooldownMs);
        setValue(page, "YouTubeRevealDelay", config.YouTubeRevealDelay);

        setValue(page, "InterfaceLanguage", config.InterfaceLanguage || "fr");
        setValue(page, "NativeLanguage", config.NativeLanguage || "fr");
        setValue(page, "LanguageSeparator", config.LanguageSeparator || " • ");

        setValue(page, "HoverSafeMargin", config.HoverSafeMargin);
        setValue(page, "BridgeHoldDelay", config.BridgeHoldDelay);
        setValue(page, "HoverZIndex", config.HoverZIndex);
        setValue(page, "Debug", config.Debug);
        setValue(page, "AutoRegisterWithJavaScriptInjector", config.AutoRegisterWithJavaScriptInjector !== false);

        applyLanguage(
            page,
            config
        );
    }

    function readForm(page, currentConfig) {
        const config = {
            ...currentConfig
        };

        config.Enabled =
            getBool(page, "Enabled");

        config.DisableOnTouchDevices =
            getBool(page, "DisableOnTouchDevices");

        config.DisableUnderWidth =
            getNumber(page, "DisableUnderWidth", 0);

        config.EnableLocalTrailers =
            getBool(page, "EnableLocalTrailers");

        config.EnableYouTubeTrailers =
            getBool(page, "EnableYouTubeTrailers");

        config.PreferLocalTrailers =
            getBool(page, "PreferLocalTrailers");

        config.VideoPreloadMode =
            getString(page, "VideoPreloadMode", "none");

        config.OpenDelay =
            getNumber(page, "OpenDelay", 180);

        config.CloseDelay =
            getNumber(page, "CloseDelay", 120);

        config.CardToHoverGrace =
            getNumber(page, "CardToHoverGrace", 420);

        config.LocalTrailerCooldownMs =
            getNumber(page, "LocalTrailerCooldownMs", 800);

        config.YouTubeRevealDelay =
            getNumber(page, "YouTubeRevealDelay", 950);

        config.InterfaceLanguage =
            getString(page, "InterfaceLanguage", "fr") === "en"
                ? "en"
                : "fr";

        config.NativeLanguage =
            getString(page, "NativeLanguage", "fr") === "en"
                ? "en"
                : "fr";

        config.LanguageSeparator =
            getString(page, "LanguageSeparator", " • ") || " • ";

        config.HoverSafeMargin =
            getNumber(page, "HoverSafeMargin", 70);

        config.BridgeHoldDelay =
            getNumber(page, "BridgeHoldDelay", 520);

        config.HoverZIndex =
            getNumber(page, "HoverZIndex", 999999);

        config.Debug =
            getBool(page, "Debug");

        return config;
    }

    function bindTabs(page) {
        if (page.dataset.cinemaHoverTabsBound === "true") {
            return;
        }

        page.dataset.cinemaHoverTabsBound =
            "true";

        const buttons =
            page.querySelectorAll(
                ".cinemaHoverTabButton"
            );

        const panels =
            page.querySelectorAll(
                ".cinemaHoverTabPanel"
            );

        buttons.forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const tab =
                        button.getAttribute("data-tab");

                    buttons.forEach(btn =>
                        btn.classList.toggle(
                            "active",
                            btn === button
                        )
                    );

                    panels.forEach(panel =>
                        panel.classList.toggle(
                            "active",
                            panel.getAttribute("data-panel") === tab
                        )
                    );
                }
            );
        });
    }

    async function init() {
        const page =
            getPage();

        if (!page) {
            return;
        }

        if (page.dataset.cinemaHoverInitialized === "true") {
            return;
        }

        page.dataset.cinemaHoverInitialized =
            "true";

        bindTabs(
            page
        );

        let config =
            await loadConfig();

        fillForm(
            page,
            config
        );

        page
            .querySelector("#cinemaHoverConfigForm")
            ?.addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    const newConfig =
                        readForm(
                            page,
                            config
                        );

                    await saveConfig(
                        newConfig
                    );

                    config =
                        newConfig;

                    applyLanguage(
                        page,
                        config
                    );

                    if (window.Dashboard?.alert) {
                        Dashboard.alert(
                            I18N[getLang(config)].saved
                        );
                    } else {
                        console.log(
                            I18N[getLang(config)].saved
                        );
                    }
                },
                { passive: false }
            );
    }

    document.addEventListener(
        "viewshow",
        event => {
            if (
                event.target &&
                event.target.id === PAGE_ID
            ) {
                init();
            }
        }
    );

    if (document.readyState !== "loading") {
        init();
    } else {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    }
})();