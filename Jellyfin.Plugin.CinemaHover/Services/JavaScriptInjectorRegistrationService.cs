using System;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.CinemaHover.Services;

public sealed class JavaScriptInjectorRegistrationService : BackgroundService
{
    private const string ScriptId = "cinema-hover-loader";

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<JavaScriptInjectorRegistrationService> _logger;

    public JavaScriptInjectorRegistrationService(
        IServiceProvider serviceProvider,
        ILogger<JavaScriptInjectorRegistrationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        for (var attempt = 1; attempt <= 10; attempt++)
        {
            if (stoppingToken.IsCancellationRequested)
            {
                return;
            }

            try
            {
                if (TryRegister())
                {
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "[CinemaHover] JavaScript Injector registration attempt {Attempt} failed",
                    attempt
                );
            }

            await Task.Delay(
                TimeSpan.FromSeconds(2),
                stoppingToken
            );
        }

        _logger.LogInformation(
            "[CinemaHover] JavaScript Injector service not found. Manual loader is still required."
        );
    }

    private bool TryRegister()
    {
        if (Plugin.Instance?.Configuration.AutoRegisterWithJavaScriptInjector != true)
        {
            _logger.LogInformation(
                "[CinemaHover] JavaScript Injector auto-registration disabled."
            );

            return true;
        }

        var serviceType =
            FindType(
                "Jellyfin.Plugin.JavaScriptInjector.Services.IJavaScriptRegistrationService"
            );

        var payloadType =
            FindType(
                "Jellyfin.Plugin.JavaScriptInjector.Model.JavaScriptRegistrationPayload"
            );

        if (serviceType is null || payloadType is null)
        {
            return false;
        }

        var service =
            _serviceProvider.GetService(serviceType);

        if (service is null)
        {
            return false;
        }

        var payload =
            Activator.CreateInstance(payloadType);

        if (payload is null)
        {
            return false;
        }

        var pluginId =
            Plugin.Instance?.Id.ToString("D") ??
            "cinema-hover";

        var pluginVersion =
            typeof(JavaScriptInjectorRegistrationService)
                .Assembly
                .GetName()
                .Version
                ?.ToString() ??
            "0.0.0";

        SetProperty(payload, "Id", ScriptId);
        SetProperty(payload, "Name", "CinemaHover Loader");
        SetProperty(payload, "PluginId", pluginId);
        SetProperty(payload, "PluginName", "CinemaHover");
        SetProperty(payload, "PluginVersion", pluginVersion);
        SetProperty(payload, "Enabled", true);
        SetProperty(payload, "RequiresAuthentication", true);
        SetProperty(payload, "Script", BuildLoaderScript(pluginVersion));

        InvokeOptional(
            service,
            serviceType,
            "UnregisterAllScriptsFromPlugin",
            pluginId
        );

        var result =
            InvokeOptional(
                service,
                serviceType,
                "RegisterScript",
                payload
            );

        if (result is bool registered && registered)
        {
            _logger.LogInformation(
                "[CinemaHover] Loader registered with JavaScript Injector."
            );

            return true;
        }

        _logger.LogWarning(
            "[CinemaHover] JavaScript Injector RegisterScript returned {Result}.",
            result
        );

        return false;
    }

    private static Type? FindType(string fullName)
    {
        return AppDomain
            .CurrentDomain
            .GetAssemblies()
            .Select(assembly =>
            {
                try
                {
                    return assembly.GetType(
                        fullName,
                        throwOnError: false,
                        ignoreCase: false
                    );
                }
                catch
                {
                    return null;
                }
            })
            .FirstOrDefault(type => type is not null);
    }

    private static void SetProperty(
        object target,
        string propertyName,
        object value)
    {
        var property =
            target
                .GetType()
                .GetProperty(
                    propertyName,
                    BindingFlags.Public |
                    BindingFlags.Instance
                );

        if (property is null || !property.CanWrite)
        {
            return;
        }

        property.SetValue(
            target,
            value
        );
    }

    private static object? InvokeOptional(
        object service,
        Type serviceType,
        string methodName,
        params object[] args)
    {
        var method =
            serviceType
                .GetMethods()
                .FirstOrDefault(method =>
                    method.Name == methodName &&
                    method.GetParameters().Length == args.Length
                );

        if (method is null)
        {
            return null;
        }

        return method.Invoke(
            service,
            args
        );
    }

    private static string BuildLoaderScript(string version)
    {
        var versionLiteral =
            JsonSerializer.Serialize(
                version
            );

        return $$"""
(function () {
    "use strict";

    const VERSION = {{versionLiteral}};

    function loadCinemaHoverCss() {
        if (document.getElementById("cinema-hover-css")) {
            return;
        }

        const link = document.createElement("link");
        link.id = "cinema-hover-css";
        link.rel = "stylesheet";
        link.href = "/CinemaHover/style.css?v=" + encodeURIComponent(VERSION);

        document.head.appendChild(link);
    }

    function loadCinemaHoverScript() {
        if (document.getElementById("cinema-hover-client")) {
            return;
        }

        const script = document.createElement("script");
        script.id = "cinema-hover-client";
        script.src = "/CinemaHover/client.js?v=" + encodeURIComponent(VERSION);
        script.defer = true;

        script.onload = function () {
            console.log("[CinemaHover] client.js loaded", {
                version: VERSION
            });
        };

        script.onerror = function (error) {
            console.error("[CinemaHover] failed to load client.js", error);
        };

        document.head.appendChild(script);
    }

    function initCinemaHoverLoader() {
        loadCinemaHoverCss();
        loadCinemaHoverScript();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initCinemaHoverLoader,
            { once: true }
        );
    } else {
        initCinemaHoverLoader();
    }
})();
""";
    }
}
