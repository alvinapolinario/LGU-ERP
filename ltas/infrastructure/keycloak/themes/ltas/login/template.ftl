<#import "footer.ftl" as loginFooter>
<#import "theme-resources.ftl" as themeResourceTags>
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <title>${title!}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <#if themeResources?? && themeResources.favicons?has_content>
        <@themeResourceTags.renderFavicons themeResources.favicons url.resourcesPath />
    <#else>
        <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
    </#if>
    <#if themeResources?? && themeResources.stylesCommon?has_content>
        <@themeResourceTags.renderStyles themeResources.stylesCommon url.resourcesCommonPath />
    <#elseif properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if themeResources?? && themeResources.styles?has_content>
        <@themeResourceTags.renderStyles themeResources.styles url.resourcesPath />
    <#elseif properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if themeResources?? && themeResources.scripts?has_content>
        <@themeResourceTags.renderScripts themeResources.scripts url.resourcesPath "text/javascript" />
    <#elseif properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        <#outputformat "JavaScript">
        import { startSessionPolling } from ${(url.resourcesPath + "/js/authChecker.js")?c};
        startSessionPolling(${url.ssoLoginInOtherTabsUrl?c});
        </#outputformat>
    </script>
    <script type="module">
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");
            if (!link) return;
            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }
            const { disabledClass } = link.dataset;
            if (disabledClass) link.classList.add(...disabledClass.trim().split(/\s+/));
            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
    <#if authenticationSession??>
        <script type="module">
            <#outputformat "JavaScript">
            import { checkAuthSession } from ${(url.resourcesPath + "/js/authChecker.js")?c};
            checkAuthSession(${authenticationSession.authSessionIdHash?c});
            </#outputformat>
        </script>
    </#if>
</head>
<body class="${properties.kcBodyClass!}" data-page-id="login-${pageId}">
<div class="${properties.kcLoginClass!}">
    <aside class="${properties.kcHeaderClass!}">
        <div class="ltas-atmosphere" aria-hidden="true">
            <span class="ltas-ring ltas-ring-a"></span>
            <span class="ltas-ring ltas-ring-b"></span>
            <span class="ltas-ring ltas-ring-c"></span>
        </div>
        <div class="ltas-story-inner">
            <div class="ltas-brand">
                <span class="ltas-seal" aria-hidden="true">
                    <svg viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="31" fill="#1f6b3a"/>
                        <circle cx="32" cy="32" r="26" fill="#e8c45a"/>
                        <circle cx="32" cy="32" r="22" fill="#7ec4e6"/>
                        <circle cx="42" cy="20" r="6" fill="#f7e27c"/>
                        <path d="M10 40 24 26l8 8 10-14 12 12 6 8H10z" fill="#2f6a3c"/>
                        <path d="M10 42c8 6 36 6 44 0v10H10z" fill="#2f7fb3"/>
                        <path d="M18 48h6v6h-6zm22-8h7v14h-7z" fill="#f4efe0"/>
                        <path d="M22 48l3-4 3 4zm22-8 3.5-5 3.5 5" fill="#d7c48a"/>
                    </svg>
                </span>
                <div>
                    <strong>Municipality of San Isidro</strong>
                    <span>Sangguniang Bayan</span>
                </div>
            </div>
            <div class="ltas-copy">
                <h2>Legislative Tracking &amp; Analysis System</h2>
                <p>Track. Analyze. Legislate for a Better Municipality.</p>
                <ul>
                    <li>Transparent records</li>
                    <li>Assigned-account access</li>
                    <li>People-centered legislation</li>
                </ul>
            </div>
            <p class="ltas-story-foot">© ${.now?string["yyyy"]} Municipality of San Isidro — Sangguniang Bayan. Fictional development records.</p>
        </div>
    </aside>
    <main class="ltas-main">
        <div class="ltas-mobile-brand">
            <span class="ltas-seal" aria-hidden="true">
                <svg viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="31" fill="#1f6b3a"/>
                    <circle cx="32" cy="32" r="26" fill="#e8c45a"/>
                    <circle cx="32" cy="32" r="22" fill="#7ec4e6"/>
                    <circle cx="42" cy="20" r="6" fill="#f7e27c"/>
                    <path d="M10 40 24 26l8 8 10-14 12 12 6 8H10z" fill="#2f6a3c"/>
                    <path d="M10 42c8 6 36 6 44 0v10H10z" fill="#2f7fb3"/>
                    <path d="M18 48h6v6h-6zm22-8h7v14h-7z" fill="#f4efe0"/>
                    <path d="M22 48l3-4 3 4zm22-8 3.5-5 3.5 5" fill="#d7c48a"/>
                </svg>
            </span>
            <strong>LTAS</strong>
            <span>Legislative Tracking &amp; Analysis System</span>
        </div>
        <p class="ltas-eyebrow">People • Policy • Progress</p>
        <div class="${properties.kcFormCardClass!}">
            <header class="${properties.kcFormHeaderClass!}">
                <#if realm.internationalizationEnabled && locale.supported?size gt 1>
                    <div class="${properties.kcLocaleMainClass!}" id="kc-locale">
                        <div id="kc-locale-wrapper" class="${properties.kcLocaleWrapperClass!}">
                            <div id="kc-locale-dropdown" class="menu-button-links ${properties.kcLocaleDropDownClass!}">
                                <button tabindex="1" id="kc-current-locale-link" aria-label="${msg("languages")}" aria-haspopup="true" aria-expanded="false" aria-controls="language-switch1">${locale.current}</button>
                                <ul role="menu" tabindex="-1" aria-labelledby="kc-current-locale-link" aria-activedescendant="" id="language-switch1" class="${properties.kcLocaleListClass!}">
                                    <#assign i = 1>
                                    <#list locale.supported as l>
                                        <li class="${properties.kcLocaleListItemClass!}" role="none">
                                            <a role="menuitem" id="language-${i}" class="${properties.kcLocaleItemClass!}" href="${l.url}">${l.label}</a>
                                        </li>
                                        <#assign i++>
                                    </#list>
                                </ul>
                            </div>
                        </div>
                    </div>
                </#if>
                <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
                    <h1 id="kc-page-title"><#nested "header"></h1>
                    <p class="ltas-lead">Enter your assigned municipal account to continue.</p>
                <#else>
                    <#nested "show-username">
                    <div id="kc-username" class="${properties.kcFormGroupClass!}">
                        <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                        <a id="reset-login" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}">
                            <div class="kc-login-tooltip">
                                <i class="${properties.kcResetFlowIcon!}"></i>
                                <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
                            </div>
                        </a>
                    </div>
                </#if>
            </header>
            <div id="kc-content">
                <div id="kc-content-wrapper">
                    <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                        <div class="alert-${message.type} ${properties.kcAlertClass!} pf-m-<#if message.type = 'error'>danger<#else>${message.type}</#if>">
                            <div class="pf-c-alert__icon">
                                <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}"></span></#if>
                                <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}"></span></#if>
                                <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}"></span></#if>
                                <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}"></span></#if>
                            </div>
                            <span class="${properties.kcAlertTitleClass!}">${kcSanitize(message.summary)?no_esc}</span>
                        </div>
                    </#if>
                    <#nested "form">
                    <#if auth?has_content && auth.showTryAnotherWayLink()>
                        <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                            <div class="${properties.kcFormGroupClass!}">
                                <input type="hidden" name="tryAnotherWay" value="on"/>
                                <a href="#" id="try-another-way" onclick="document.forms['kc-select-try-another-way-form'].requestSubmit();return false;">${msg("doTryAnotherWay")}</a>
                            </div>
                        </form>
                    </#if>
                    <#nested "socialProviders">
                    <#if displayInfo>
                        <div id="kc-info" class="${properties.kcSignUpClass!}">
                            <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                                <#nested "info">
                            </div>
                        </div>
                    </#if>
                </div>
            </div>
            <@loginFooter.content/>
        </div>
        <p class="ltas-secure">Identity is verified through the municipal sign-in service. There is no guest or demo bypass.</p>
    </main>
</div>
</body>
</html>
</#macro>
