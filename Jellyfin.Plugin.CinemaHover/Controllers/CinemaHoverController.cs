using System;
using System.IO;
using System.Reflection;
using Jellyfin.Plugin.CinemaHover.Configuration;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.CinemaHover.Controllers;

[ApiController]
[Route("CinemaHover")]
public class CinemaHoverController : ControllerBase
{
    [HttpGet("config")]
    public ActionResult<PluginConfiguration> GetConfig()
    {
        if (Plugin.Instance is null)
        {
            return NotFound();
        }

        return Plugin.Instance.Configuration;
    }

    [HttpPost("config")]
    public IActionResult SaveConfig([FromBody] PluginConfiguration config)
    {
        if (Plugin.Instance is null)
        {
            return NotFound();
        }

        NormalizeConfig(config);

        Plugin.Instance.UpdateConfiguration(config);

        return NoContent();
    }

    [HttpGet("client.js")]
    public IActionResult GetClientScript()
    {
        return GetEmbeddedFile(
            "Web.cinema-hover.client.js",
            "application/javascript; charset=utf-8"
        );
    }

    [HttpGet("style.css")]
    public IActionResult GetStyle()
    {
        return GetEmbeddedFile(
            "Web.cinema-hover.css",
            "text/css; charset=utf-8"
        );
    }

    [HttpGet("assets/{fileName}")]
    public IActionResult GetAsset(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return NotFound();
        }

        if (
            fileName.Contains(
                '/',
                StringComparison.Ordinal
            ) ||
            fileName.Contains(
                '\\',
                StringComparison.Ordinal
            ) ||
            fileName.Contains(
                "..",
                StringComparison.Ordinal
            )
        )
        {
            return BadRequest();
        }

        var contentType =
            Path.GetExtension(fileName)
                .ToLowerInvariant() switch
                {
                    ".png" => "image/png",
                    ".svg" => "image/svg+xml; charset=utf-8",
                    ".webp" => "image/webp",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    _ => "application/octet-stream"
                };

        return GetEmbeddedFile(
            $"Web.Assets.{fileName}",
            contentType
        );
    }

    private static void NormalizeConfig(PluginConfiguration config)
    {
        config.InterfaceLanguage =
            config.InterfaceLanguage == "en"
                ? "en"
                : "fr";

        config.NativeLanguage =
            config.NativeLanguage == "en"
                ? "en"
                : "fr";

        if (string.IsNullOrEmpty(config.LanguageSeparator))
        {
            config.LanguageSeparator = " • ";
        }

        config.VideoPreloadMode =
            config.VideoPreloadMode switch
            {
                "auto" => "auto",
                "metadata" => "metadata",
                _ => "none"
            };

        config.OpenDelay =
            Math.Clamp(config.OpenDelay, 0, 3000);

        config.CloseDelay =
            Math.Clamp(config.CloseDelay, 0, 3000);

        config.CardToHoverGrace =
            Math.Clamp(config.CardToHoverGrace, 0, 5000);

        config.HoverSafeMargin =
            Math.Clamp(config.HoverSafeMargin, 0, 300);

        config.BridgeHoldDelay =
            Math.Clamp(config.BridgeHoldDelay, 0, 5000);

        config.YouTubeRevealDelay =
            Math.Clamp(config.YouTubeRevealDelay, 0, 5000);

        config.LocalTrailerCooldownMs =
            Math.Clamp(config.LocalTrailerCooldownMs, 0, 10000);

        config.DisableUnderWidth =
            Math.Clamp(config.DisableUnderWidth, 0, 4000);

        config.HoverZIndex =
            Math.Clamp(config.HoverZIndex, 1, 999999);
    }

    private IActionResult GetEmbeddedFile(
        string resourceSuffix,
        string contentType)
    {
        var assembly =
            Assembly.GetExecutingAssembly();

        var resourceName =
            Array.Find(
                assembly.GetManifestResourceNames(),
                name => name.EndsWith(
                    resourceSuffix,
                    StringComparison.Ordinal
                )
            );

        if (resourceName is null)
        {
            return NotFound(
                $"Embedded resource not found: {resourceSuffix}"
            );
        }

        var stream =
            assembly.GetManifestResourceStream(
                resourceName
            );

        if (stream is null)
        {
            return NotFound(
                $"Embedded resource stream not found: {resourceSuffix}"
            );
        }

        return File(
            stream,
            contentType
        );
    }
}