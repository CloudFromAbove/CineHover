using System;
using System.Collections.Generic;
using Jellyfin.Plugin.CinemaHover.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.CinemaHover;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public Plugin(
        IApplicationPaths applicationPaths,
        IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "CineHover";

    public override Guid Id => Guid.Parse("0caebf89-0651-4513-987f-7cb23035e5d5");

    public override string Description =>
        "Cinema-style hover trailer previews for Jellyfin Web.";

    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = "cinemahover",
                EmbeddedResourcePath = GetType().Namespace + ".Pages.cinemahover.html"
            },
            new PluginPageInfo
            {
                Name = "cinemahoverjs",
                EmbeddedResourcePath = GetType().Namespace + ".Pages.cinemahover.js"
            }
        };
    }
}
