using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.CinemaHover.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public bool Enabled { get; set; } = true;

    public bool EnableLocalTrailers { get; set; } = false;

    public bool EnableYouTubeTrailers { get; set; } = false;

    public bool PreferLocalTrailers { get; set; } = true;

    public int OpenDelay { get; set; } = 310;

    public int CloseDelay { get; set; } = 120;

    public int CardToHoverGrace { get; set; } = 420;

    public int HoverSafeMargin { get; set; } = 70;

    public int BridgeHoldDelay { get; set; } = 520;

    public int YouTubeRevealDelay { get; set; } = 950;

    public int LocalTrailerCooldownMs { get; set; } = 800;

    public string VideoPreloadMode { get; set; } = "none";

    public string InterfaceLanguage { get; set; } = "fr";

    public string NativeLanguage { get; set; } = "fr";

    public string LanguageSeparator { get; set; } = " • ";

    public bool DisableOnTouchDevices { get; set; } = true;

    public int DisableUnderWidth { get; set; } = 0;

    public int HoverZIndex { get; set; } = 999999;

    public bool Debug { get; set; } = false;

    public bool AutoRegisterWithJavaScriptInjector { get; set; } = true;
}