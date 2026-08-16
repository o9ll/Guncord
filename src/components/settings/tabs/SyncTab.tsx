import {
    addBadgeVisibilityListener,
    BadgeSource,
    getOwnHiddenBadgeSources,
    removeBadgeVisibilityListener,
    setOwnHiddenBadgeSources,
} from "@api/BadgeVisibility";
import { useSettings } from "@api/Settings";
import { beginDiscordOAuth, checkOAuthToken, clearToken, getStoredToken, storeToken } from "@api/OAuth2";
import { authorizeCloud, deauthorizeCloud } from "@api/SettingsSync/cloudSetup";
import { deleteCloudSettings, eraseAllCloudData, getCloudSettings, putCloudSettings } from "@api/SettingsSync/cloudSync";

import { Button } from "@components/Button";
import { CheckedTextInput } from "@components/CheckedTextInput";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { CloudDownloadIcon, CloudUploadIcon, DeleteIcon } from "@components/Icons";
import { Link } from "@components/Link";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";

import { localStorage } from "@utils/localStorage";
import { Margins } from "@utils/margins";
import { openModal } from "@utils/modal";
import { useForceUpdater } from "@utils/react";
import { findComponentByCodeLazy } from "@webpack";
import { Alerts, React, useState, OAuth2AuthorizeModal } from "@webpack/common";
import { SafeSearchableSelect } from "@components/SafeSearchableSelect";
import { t } from "@api/i18n";

const ICON_STYLE: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, verticalAlign: "middle" };
const GUNCORD_ICON_STYLE: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, verticalAlign: "middle" };

const GUNCORD_ICON_DATA_URI = "data:image/png;base64,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"

function GuncordIcon() {
    return <img src={GUNCORD_ICON_DATA_URI} alt="Guncord" style={GUNCORD_ICON_STYLE} />;
}

function EquicordIcon() {
    return <img src="https://equicord.org/assets/favicon.png" alt="Equicord" style={ICON_STYLE} />;
}

function VencordIcon() {
    return <img src="https://equicord.org/assets/icons/vencord/icon-light.png" alt="Vencord" style={ICON_STYLE} />;
}

function GlobalBadgesIcon() {
    return <img src="https://equicord.org/assets/icons/misc/userplugin.png" alt="GlobalBadges" style={ICON_STYLE} />;
}

const RefreshIcon = findComponentByCodeLazy("M4 12a8 8 0 0 1 14.93-4H15");
const TrashIcon = findComponentByCodeLazy("2.81h8.36a3");

function validateUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch {
        return "Invalid URL";
    }
}

const cloudBackendOptions = [
    { label: "Equicord Cloud", value: "https://cloud.equicord.org/" },
    { label: "Vencord Cloud", value: "https://api.vencord.dev/" }
];

const syncDirectionOptions = [
    { label: "Two-way sync (changes go both directions)", value: "both" },
    { label: "This device is the source (upload only)", value: "push" },
    { label: "The cloud is the source (download only)", value: "pull" },
    { label: "Do not sync automatically (manual sync via buttons below only)", value: "manual" }
];

const BADGE_OPTIONS: Array<{ label: string; value: BadgeSource }> = [
    { label: "Guncord Badges", value: "guncord" },
    { label: "Equicord Badges", value: "equicord" },
    { label: "Vencord Badges", value: "vencord" },
    { label: "GlobalBadges", value: "globalbadges" },
];

function renderPrefix(option: { value: BadgeSource }) {
    switch (option.value) {
        case "guncord": return <GuncordIcon />;
        case "equicord": return <EquicordIcon />;
        case "vencord": return <VencordIcon />;
        case "globalbadges": return <GlobalBadgesIcon />;
        default: return null;
    }
}

function CustomProfileSyncToggle() {
    const settings = useSettings();
    const [token, setToken] = React.useState<string | null>(null);
    const [checking, setChecking] = React.useState(true);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        let isMounted = true;
        getStoredToken().then(async t => {
            if (!isMounted) return;
            if (t) {
                const check = await checkOAuthToken(t);
                if (!isMounted) return;
                if (check?.valid) {
                    setToken(t);
                    settings.syncOwnCustomProfile = true;
                    settings.seeAllCustomProfile = true;
                } else {
                    await clearToken();
                    if (!isMounted) return;
                    settings.syncOwnCustomProfile = false;
                    settings.seeAllCustomProfile = false;
                }
            } else {
                settings.syncOwnCustomProfile = false;
                settings.seeAllCustomProfile = false;
            }
            setChecking(false);
        });
        return () => { isMounted = false; };
    }, []);

    const isEnabled = !!token;

    async function handleToggle(on: boolean) {
        if (busy) return;
        if (on) {
            setBusy(true);
            let oauthData: { url: string; redirectUri: string; scopes: string[]; clientId?: string; } | null = null;
            try {
                oauthData = await beginDiscordOAuth();
            } catch (e) {
                console.error("[CustomProfileSync] Failed to fetch OAuth config:", e);
                setBusy(false);
                return;
            }
            setBusy(false);

            let clientId = oauthData.clientId;
            if (!clientId) {
                try {
                    clientId = new URL(oauthData.url).searchParams.get("client_id") ?? undefined;
                } catch { }
            }
            if (!clientId) return;

            openModal(oauthProps => <OAuth2AuthorizeModal
                {...oauthProps}
                scopes={oauthData!.scopes}
                responseType="code"
                redirectUri={oauthData!.redirectUri}
                permissions={0n}
                clientId={clientId!}
                cancelCompletesFlow={false}
                callback={async ({ location }: any) => {
                    if (!location) return;
                    try {
                        const res = await fetch(location, { headers: { Accept: "application/json" } });
                        const { token: newToken } = await res.json();
                        if (newToken) {
                            await storeToken(newToken);
                            setToken(newToken);
                            settings.syncOwnCustomProfile = true;
                            settings.seeAllCustomProfile = true;
                        }
                    } catch (e) {
                        console.error("[CustomProfileSync] OAuth callback failed:", e);
                    }
                }}
            />);
        } else {
            setBusy(true);
            await clearToken();
            setToken(null);
            settings.syncOwnCustomProfile = false;
            settings.seeAllCustomProfile = false;
            setBusy(false);
        }
    }

    if (checking) return null;

    return (
        <div style={{ marginBottom: 16 }}>
            <FormSwitch
                value={isEnabled}
                onChange={handleToggle}
                title={t("Sync")}
                description={isEnabled
                    ? t("Your custom profile is synced. Other Guncord users can see your profile, and you can see theirs.")
                    : t("Enable to share your custom profile with other Guncord users and see their profiles.")}
                disabled={busy}
            />

            {isEnabled && (
                <div style={{ marginTop: 4 }}>
                    <a role="button" onClick={async () => {
                        await clearToken();
                        setToken(null);
                        settings.syncOwnCustomProfile = false;
                        settings.seeAllCustomProfile = false;
                    }} style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                        {t("Disconnect account")}
                    </a>
                </div>
            )}
        </div>
    );
}

function CloudIntegrationSection() {
    const settings = useSettings(["cloud.authenticated", "cloud.url", "cloud.settingsSync"]);
    const [inputKey, setInputKey] = useState(0);
    const forceUpdate = useForceUpdater();

    const { cloud } = settings;
    const isAuthenticated = cloud.authenticated;
    const syncEnabled = isAuthenticated && cloud.settingsSync;

    async function changeUrl(url: string) {
        cloud.url = url;
        cloud.authenticated = false;

        await deauthorizeCloud();
        await authorizeCloud();

        setInputKey(prev => prev + 1);
    }

    return (
        <>
            <Heading className={Margins.top16}>{t("Cloud Integration")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Guncord's cloud integration allows you to sync your settings across multiple devices and Discord installations. Your data is securely stored and can be easily restored at any time.")}
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                {t("We use our own Guncord Cloud backend with enhanced features.")}
                {" "}
                {t("View our privacy policy to see what we store and how we use your data.")}
            </Notice.Info>

            <FormSwitch
                title={t("Enable Cloud Integration")}
                description={t("Connect to the cloud backend for settings synchronization. This will request authorization if you haven't set up cloud integration yet.")}
                value={isAuthenticated}
                onChange={v => {
                    if (v)
                        authorizeCloud();
                    else
                        cloud.authenticated = v;
                }}
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Cloud Backend")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Choose which cloud backend to use for storing your settings.")}
            </Paragraph>

            <div className={Margins.bottom8}>
                <SafeSearchableSelect
                    options={cloudBackendOptions}
                    value={cloudBackendOptions.find(o => o.value === cloud.url)?.value}
                    onChange={v => changeUrl(v)}
                    closeOnSelect={true}
                    renderOptionPrefix={o => {
                        if (o?.value?.includes("guncord")) return <GuncordIcon />;
                        if (o?.value?.includes("equicord")) return <EquicordIcon />;
                        return <VencordIcon />;
                    }}
                />
            </div>

            <Flex gap="8px" alignItems="center">
                <div style={{ flex: 1 }}>
                    <CheckedTextInput
                        key={"backendUrl-" + inputKey}
                        value={cloud.url}
                        onChange={async v => {
                            cloud.url = v;
                            cloud.authenticated = false;
                            await deauthorizeCloud();
                        }}
                        validate={validateUrl}
                    />
                </div>
                <Button
                    disabled={!isAuthenticated}
                    onClick={async () => {
                        cloud.authenticated = false;
                        await deauthorizeCloud();
                        await authorizeCloud();
                    }}
                >
                    <Flex gap="8px" alignItems="center">
                        <RefreshIcon color="currentColor" />
                        {t("Reauthorize")}
                    </Flex>
                </Button>
            </Flex>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Settings Sync")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Synchronize your Guncord settings to the cloud. This makes it easy to keep your configuration consistent across multiple devices without manual import/export.")}
            </Paragraph>

            <FormSwitch
                title={t("Enable Settings Sync")}
                description={t("When enabled, your settings can be synced to and from the cloud. Use the actions below to manually sync.")}
                value={cloud.settingsSync}
                onChange={v => { cloud.settingsSync = v; }}
                disabled={!isAuthenticated}
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Sync Rules for This Device")}</Heading>
            <Paragraph className={Margins.bottom16}>
                <span dangerouslySetInnerHTML={{ __html: t("This setting controls how settings move between <strong>this device</strong> and the cloud. You can let changes flow both ways, or choose one place to be the main source of truth.") }} />
            </Paragraph>

            <SafeSearchableSelect
                options={syncDirectionOptions}
                value={localStorage.Vencord_cloudSyncDirection ?? "both"}
                onChange={v => {
                    localStorage.Vencord_cloudSyncDirection = v;
                    forceUpdate();
                }}
                disabled={!syncEnabled}
                closeOnSelect={true}
            />

            <Flex gap="8px" className={Margins.top16}>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => putCloudSettings(true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudUploadIcon />
                        {t("Sync to Cloud")}
                    </Flex>
                </Button>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => getCloudSettings(true, true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudDownloadIcon />
                        {t("Sync from Cloud")}
                    </Flex>
                </Button>
            </Flex>

            {!isAuthenticated && (
                <Notice.Warning className={Margins.top8}>
                    {t("Enable cloud integration above to use settings sync features.")}
                </Notice.Warning>
            )}

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Danger Zone")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Permanently delete all your data from the cloud. This action cannot be undone and will remove all synced settings and any other data stored on the cloud backend.")}
            </Paragraph>

            <Flex gap="8px">
                <Button
                    variant="dangerPrimary"
                    size="medium"
                    disabled={!syncEnabled}
                    onClick={() => deleteCloudSettings()}
                >
                    <Flex gap="8px" alignItems="center">
                        <TrashIcon color="currentColor" />
                        {t("Delete Cloud Settings")}
                    </Flex>
                </Button>
                <Button
                    variant="dangerSecondary"
                    size="medium"
                    disabled={!isAuthenticated}
                    onClick={() => Alerts.show({
                        title: t("Delete Cloud Account"),
                        body: t("Are you sure you want to permanently delete your cloud account and all associated data? This action cannot be undone."),
                        onConfirm: eraseAllCloudData,
                        confirmText: t("Delete Cloud Account"),
                        confirmColor: "vc-cloud-erase-data-danger-btn",
                        cancelText: t("Cancel")
                    })}
                >
                    <Flex gap="8px" alignItems="center">
                        <DeleteIcon />
                        {t("Delete Cloud Account")}
                    </Flex>
                </Button>
            </Flex>
        </>
    );
}

function SyncTab() {
    const [hidden, setHidden] = useState<BadgeSource[]>(getOwnHiddenBadgeSources());
    const [saving, setSaving] = useState(false);

    React.useEffect(() => {
        const listener = () => setHidden([...getOwnHiddenBadgeSources()]);
        addBadgeVisibilityListener(listener);
        return () => removeBadgeVisibilityListener(listener);
    }, []);

    async function onChange(next: BadgeSource[]) {
        setHidden(next);
        setSaving(true);
        try {
            await setOwnHiddenBadgeSources(next);
        } finally {
            setSaving(false);
        }
    }

    return (
        <SettingsTab>
            <CustomProfileSyncToggle />

            <Divider className={Margins.bottom16} />

            <CloudIntegrationSection />

            <Divider className={Margins.bottom16} />

            <Heading className={Margins.top16}>{t("Badges")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Choose which badge sources to hide on your own profile. Selected sources disappear from your profile for everyone — including yourself — wherever it's viewed.")}
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                {t("This only affects your own profile. The first time you select a badge to hide, you'll be asked to sign in with Discord so your preference can be shared with others viewing your profile.")}
            </Notice.Info>

            <Divider className={Margins.bottom16} />

            <Heading className={Margins.bottom8} style={{ fontSize: 14 }}>{t("Hidden Badge Sources")}</Heading>
            <div className={Margins.bottom8}>
                <SafeSearchableSelect
                    multi
                    closeOnSelect={false}
                    options={BADGE_OPTIONS}
                    value={hidden}
                    placeholder={t("None hidden")}
                    onChange={onChange}
                    renderOptionPrefix={renderPrefix}
                />
            </div>

            {saving && (
                <Paragraph className={Margins.top8} style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {t("Saving...")}
                </Paragraph>
            )}
        </SettingsTab>
    );
}

export default wrapTab(SyncTab, "Synchronization");

