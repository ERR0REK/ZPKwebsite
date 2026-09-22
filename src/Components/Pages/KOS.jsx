/* src/Components/Pages/KOS.jsx */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../Navbar/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Skull,
    Search,
    Target,
    Building2,
    ShieldAlert,
    Cpu,
    Eye,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Youtube,
    Clapperboard,
    Image,
    User,
    Database,
    MessageCircle,
    Link2,
    Loader2,
    Lock,
    Copy,
    Check,
    ArrowUpDown
} from 'lucide-react';
import DecodedText from '../Shared/DecodedText';
import kosTargets from '../../data/kosTargets.json';
import useCloudStore from '../../hooks/useCloudStore';
import { useSession } from '../../Context/SessionContext';
import KOSManagePanel from '../KOS/KOSManagePanel';
import { rehostEvidenceText, onImageError } from '../../utils/evidence';
import './KOS.css';

const INITIAL_PERSONAL = 4;
const INITIAL_FACTION = 3;
const STORAGE_PERSONAL = 'zpk_kos_personal';
const STORAGE_FACTION = 'zpk_kos_faction';
const STORAGE_HIDDEN = 'zpk_kos_hidden'; // nazwy celów usuniętych przez admina

const REASON_KEYS = [
    'reasonExploit',
    'reasonSpy',
    'reasonScam',
    'reasonRaid',
    'reasonGrief',
    'reasonImpersonation',
    'reasonHate'
];

// ============================================================================
// ☁️ Stabilne referencje dla useCloudStore — obliczane RAZ na poziomie modułu.
// Wcześniej seedData (nowy obiekt) i normalizeFn (nowa strzałka) powstawały
// przy każdym renderze → hook tworzył nowe fetchData → każdy render strony
// (wpisanie znaku w wyszukiwarkę, otwarcie panelu) odpalał ponowny GET do
// /api/kos-store. Burza requestów + chwilowe błędy = fałszywe przełączenie
// strony w tryb lokalny ("Zarządzaj lokalnie") i gubienie wpisów.
// ============================================================================
const STATIC_PERSONAL_TARGETS = Array.isArray(kosTargets.personal) ? kosTargets.personal : [];
const STATIC_FACTION_TARGETS = Array.isArray(kosTargets.factions) ? kosTargets.factions : [];
const KOS_CLOUD_SEED = { personal: STATIC_PERSONAL_TARGETS, factions: STATIC_FACTION_TARGETS };
const KOS_NORMALIZE_FN = (res) => ({
    personal: Array.isArray(res.personal) ? res.personal : [],
    factions: Array.isArray(res.factions) ? res.factions : [],
});

const EvidenceIcon = ({ type, size = 14 }) => {
    if (type === 'youtube') return <Youtube size={size} />;
    if (type === 'discord') return <MessageCircle size={size} />;
    if (type === 'other') return <Link2 size={size} />;
    return <Clapperboard size={size} />; // medal + fallback
};



// Merge code-defined targets with locally stored ones.
// WAŻNE: cele z kodu (statyczne) mają pierwszeństwo — to one są
// źródłem prawdy (customowy powód, poprawne ścieżki dowodów).
// Cele z localStorage są dodawane TYLKO gdy nie ma ich w kodzie.
// Dzięki temu stara/nieaktualna wersja zapisana w przeglądarce
// nie nadpisuje poprawionej wersji z kodu.
// hiddenList = nazwy usuniętych celów (usunięte nie wracają po odświeżeniu).
// Tylko cele z poprawną nazwą trafiają do listy — chroni przed pustymi
// obiektami (placeholdery w kodzie) oraz uszkodzonymi danymi w localStorage.
const mergeTargets = (staticList, storedList, hiddenList = []) => {
    const map = new Map();
    const isUsable = (t) =>
        t && typeof t.name === 'string' && t.name.trim() !== '';
    staticList.forEach((t) => {
        if (isUsable(t) && !hiddenList.includes(t.name)) map.set(t.name, t);
    });
    storedList.forEach((t) => {
        if (isUsable(t) && !map.has(t.name) && !hiddenList.includes(t.name)) {
            map.set(t.name, t);
        }
    });
    return Array.from(map.values());
};

const loadStored = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        /* ignore corrupted storage */
    }
    return [];
};

const parseEvidenceLines = (text) =>
    text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [type, a, b] = line.split('|').map((s) => s.trim());
            if (!a) return null;
            if (type === 'image') return { type: 'image', src: a };
            if (type === 'youtube') return { type: 'youtube', url: a, title: b || '' };
            if (type === 'medal') return { type: 'medal', url: a, title: b || '' };
            if (type === 'discord') return { type: 'discord', url: a, title: b || '' };
            if (type === 'other') return { type: 'other', url: a, title: b || '' };
            return null;
        })
        .filter(Boolean);

// Przycisk kopiowania nazwy celu — 1 klik = nick w schowku.
// Z fallbackiem dla przeglądarek bez navigator.clipboard (http).
const CopyNameButton = ({ name }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(name);
        } catch (err) {
            // Fallback (np. przeglądarka bez uprawnień clipboard API)
            const ta = document.createElement('textarea');
            ta.value = name;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            className={`copy-name-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? t('kos.copied') : t('kos.copyName')}
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? t('kos.copied') : t('kos.copyName')}</span>
        </button>
    );
};

const KOS = () => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // all, personal, faction
    const [sortMode, setSortMode] = useState('default'); // default, name-asc, name-desc
    const [selectedTarget, setSelectedTarget] = useState(null); // { type, ...target }
    const [expandedReasons, setExpandedReasons] = useState({}); // cardKey -> bool
    const [showAll, setShowAll] = useState({ personal: false, faction: false });
    const [manageOpen, setManageOpen] = useState(false);
    const [manageTab, setManageTab] = useState('personal'); // personal, faction
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [form, setForm] = useState({
        name: '',
        reasonMode: 'preset', // 'preset' | 'custom'
        reasonKey: REASON_KEYS[0],
        customReason: '',
        robloxLink: '',
        leaders: '',
        allies: '',
        firepower: '',
        evidenceText: ''
    });

    const [adminMessage, setAdminMessage] = useState(''); // komunikat w panelu zarządzania

    const { session } = useSession();

    // Weryfikacja admina NA ŻYWO — KOS sprawdza rolę przez /api/verify-admin
    // przy każdym wejściu na stronę, zamiast ufać tylko flagi zapisanej przy
    // logowaniu. Dzięki temu nadanie roli na Discordzie działa od razu, bez
    // wylogowywania. Fallback: flaga is_admin z sesji (gdy funkcja nie działa).
    const [isAdmin, setIsAdmin] = useState(session?.is_admin === true);
    const [adminChecking, setAdminChecking] = useState(false);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!session || !session.access_token) {
                setIsAdmin(false);
                return;
            }
            setAdminChecking(true);
            try {
                const res = await fetch('/api/verify-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: session.access_token })
                });
                const data = await res.json();
                if (cancelled) return;
                if (data && data.ok) {
                    setIsAdmin(data.is_admin === true);
                }
            } catch (err) {
                // Fallback: zostaje flaga z sesji
            } finally {
                if (!cancelled) setAdminChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [session]);

    // ==================================================================
    // 📌 CELE PODSTAWOWE (FALLBACK) — EDYTUJ JE W src/data/kosTargets.json
    //
    // UWAGA: po wdrożeniu funkcji kos-store (Netlify Blobs) głównym
    // źródłem prawdy jest wspólna chmura — cele dodane przez adminów
    // na stronie /kos zapisują się tam i widzą je wszyscy gracze.
    // Ten plik JSON to baza startowa oraz fallback, gdyby chmura nie
    // odpowiedziała (offline / lokalny dev). Po zmianie pliku:
    // git commit + git push → Netlify sam zbuduje i wdroży stronę.
    //
    // Struktura pliku:
    //   {
    //     "personal": [ ...obiekty OSOB... ],
    //     "factions": [ ...obiekty KLANÓW... ]
    //   }
    //
    // Dostępne reasonKey (powód → tłumaczenie w Locales/en.json i pl.json):
    //   reasonExploit, reasonSpy, reasonScam, reasonRaid,
    //   reasonGrief, reasonImpersonation, reasonHate
    //
    // CUSTOMOWY POWÓD: zamiast reasonKey wpisz własny tekst w polu
    //   "reason": "Twój własny powód np. zdrada sojuszu"
    //
    // Dowody (evidence) — możesz dodać dowolną liczbę, typy:
    //   { "type": "image",   "src": "/kos/nazwa-pliku.png" }   ← zdjęcia w folderze public/kos/
    //   { "type": "youtube", "url": "...", "title": "..." }
    //   { "type": "medal",   "url": "...", "title": "..." }
    //   { "type": "discord", "url": "https://discord.com/channels/...", "title": "..." }
    //   { "type": "other",   "url": "...", "title": "..." }
    //
    // Dla KLANÓW dodatkowo pole intel:
    //   "intel": { "leaders": "Lider1, Lider2", "allies": "Klan Sojuszniczy", "firepower": "HEAVY_ARMORED" }
    // ==================================================================
    // Zabezpieczenie przed literówką w pliku JSON (np. "personal": {})
    // — referencje stabilne (poziom modułu), patrz komentarz przy KOS_CLOUD_SEED.
    const staticPersonalTargets = STATIC_PERSONAL_TARGETS;
    const staticFactionTargets = STATIC_FACTION_TARGETS;

    const initialHidden = loadStored(STORAGE_HIDDEN);
    const [hiddenNames, setHiddenNames] = useState(() => initialHidden);

    // ☁️ useCloudStore — fetch z chmury, fallback na seed, realtime (Ably)
    // Zamiast zduplikowanej logiki fetch + subscribe w KOS i WarLogs.
    const { data: cloudData, cloudReady, refresh: refreshCloud } = useCloudStore({
        endpoint: '/api/kos-store',
        channel: 'zpk-kos-updates',
        seedData: KOS_CLOUD_SEED,
        normalizeFn: KOS_NORMALIZE_FN,
    });

    // Scal dane z chmury/seed z hiddenNames — cele usunięte przez admina nie wracają
    const [personalTargets, setPersonalTargets] = useState(() =>
        mergeTargets(staticPersonalTargets, [])
    );
    const [factionTargets, setFactionTargets] = useState(() =>
        mergeTargets(staticFactionTargets, [])
    );

    // Aktualizuj cele gdy cloudData się zmieni (fetch/refresh/realtime)
    useEffect(() => {
        if (!cloudData) return;
        setPersonalTargets(
            mergeTargets(cloudData.personal || [], [], hiddenNames)
        );
        setFactionTargets(
            mergeTargets(cloudData.factions || [], [], hiddenNames)
        );
    }, [cloudData, hiddenNames]);

    // Zapis do localStorage (fallback offline)
    useEffect(() => {
        if (cloudReady === null) return;
        try {
            localStorage.setItem(STORAGE_PERSONAL, JSON.stringify(personalTargets));
        } catch (e) { /* ignore */ }
    }, [personalTargets, cloudReady]);

    useEffect(() => {
        if (cloudReady === null) return;
        try {
            localStorage.setItem(STORAGE_FACTION, JSON.stringify(factionTargets));
        } catch (e) { /* ignore */ }
    }, [factionTargets, cloudReady]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_HIDDEN, JSON.stringify(hiddenNames));
        } catch (e) { /* ignore */ }
    }, [hiddenNames]);

    const upsertTarget = (list, target) => [
        ...list.filter((x) => x.name !== target.name),
        target
    ];

    const handleAddTarget = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setAdminMessage('');
        const newName = form.name.trim();
        // Jeśli cel był wcześniej usunięty, przywróć go (usuń z ukrytych)
        setHiddenNames((prev) => prev.filter((n) => n !== newName));

        // ⚠️ CROSS-PLATFORM DOWODY: linki obrazów z Discorda
        // (cdn.discordapp.com / media.discordapp.net) mają podpis i WYGAJĄ
        // po ~24h. Zanim zapiszemy cel, przenosimy je na Catbox (linki
        // wieczne). Nieudany rehost nie blokuje dodania celu.
        let evidenceText = form.evidenceText;
        let rehostNotice = '';
        if (cloudReady && session?.access_token) {
            try {
                const rh = await rehostEvidenceText(evidenceText, session.access_token);
                if (rh.changed) {
                    evidenceText = rh.text;
                    const bits = [];
                    if (rh.rehosted) bits.push(t('kos.manage.rehostDone', { count: rh.rehosted }));
                    if (rh.failed) bits.push(t('kos.manage.rehostFailed', { count: rh.failed }));
                    rehostNotice = bits.join(' ');
                }
            } catch (err) { /* rehost nie może zablokować dodania celu */ }
        }

        const newTarget = {
            name: newName,
            evidence: parseEvidenceLines(evidenceText)
        };
        if (form.reasonMode === 'custom' && form.customReason.trim()) {
            newTarget.reason = form.customReason.trim();
        } else {
            newTarget.reasonKey = form.reasonKey;
        }
        if (manageTab === 'personal') {
            newTarget.robloxLink = form.robloxLink.trim();
        } else {
            newTarget.intel = {
                leaders: form.leaders.trim() || '???',
                allies: form.allies.trim() || '???',
                firepower: form.firepower.trim() || 'UNKNOWN'
            };
        }
        const section = manageTab === 'personal' ? 'personal' : 'faction';
        const applyLocal = () => {
            if (section === 'personal') {
                setPersonalTargets((prev) => upsertTarget(prev, newTarget));
            } else {
                setFactionTargets((prev) => upsertTarget(prev, newTarget));
            }
        };

        // ☁️ Zapis do wspólnej chmury (Netlify Blobs) — jeśli dostępna
        if (cloudReady) {
            try {
                const res = await fetch('/api/kos-store', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        access_token: session?.access_token,
                        type: section,
                        target: newTarget
                    })
                });
                const data = await res.json();
                if (res.ok && data && data.ok) {
                    applyLocal(); // natychmiastowy feedback; refetch uzgodni z chmurą
                    refreshCloud();
                    setAdminMessage(
                        t('kos.manage.msgAddedCloud', { name: newName }) +
                        (rehostNotice ? ' ' + rehostNotice : '')
                    );
                } else {
                    applyLocal();
                    setAdminMessage(t('kos.manage.msgSavedLocal', { name: newName }));
                }
            } catch (err) {
                applyLocal();
                setAdminMessage(t('kos.manage.msgSavedLocal', { name: newName }));
            }
        } else {
            applyLocal();
            setAdminMessage(t('kos.manage.msgSavedLocal', { name: newName }));
        }

        setForm({
            name: '',
            reasonMode: 'preset',
            reasonKey: REASON_KEYS[0],
            customReason: '',
            robloxLink: '',
            leaders: '',
            allies: '',
            firepower: '',
            evidenceText: ''
        });
    };

    const handleRemoveTarget = async (name) => {
        // Zapamiętaj nazwę jako ukrytą, żeby cel nie wrócił po odświeżeniu
        setHiddenNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
        const section = manageTab === 'personal' ? 'personal' : 'faction';
        const applyLocal = () => {
            if (section === 'personal') {
                setPersonalTargets((prev) => prev.filter((x) => x.name !== name));
            } else {
                setFactionTargets((prev) => prev.filter((x) => x.name !== name));
            }
        };

        // ☁️ Usunięcie z wspólnej chmury — jeśli dostępna
        if (cloudReady) {
            try {
                const res = await fetch('/api/kos-store', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        access_token: session?.access_token,
                        type: section,
                        name
                    })
                });
                const data = await res.json();
                if (res.ok && data && data.ok) {
                    refreshCloud();
                    setAdminMessage(t('kos.manage.msgRemovedCloud', { name }));
                    return;
                }
                setAdminMessage(t('kos.manage.msgRemovedLocal', { name }));
            } catch (err) {
                setAdminMessage(t('kos.manage.msgRemovedLocal', { name }));
            }
        } else {
            setAdminMessage(t('kos.manage.msgRemovedLocal', { name }));
        }
        applyLocal();
    };

    const handleResetLocal = () => {
        if (window.confirm(t('kos.manage.resetConfirm'))) {
            try {
                localStorage.removeItem(STORAGE_PERSONAL);
                localStorage.removeItem(STORAGE_FACTION);
                localStorage.removeItem(STORAGE_HIDDEN);
            } catch (e) { /* ignore */ }
            setHiddenNames([]);
            refreshCloud();
        }
    };

    const matchesSearch = (target) =>
        target.name.toLowerCase().includes(searchTerm.trim().toLowerCase());

    const filteredPersonal = personalTargets.filter(
        (target) =>
            matchesSearch(target) &&
            (activeFilter === 'all' || activeFilter === 'personal')
    );

    const filteredFactions = factionTargets.filter(
        (target) =>
            matchesSearch(target) &&
            (activeFilter === 'all' || activeFilter === 'faction')
    );

    // Sortowanie (nie modyfikuje źródłowych list — sortujemy kopię)
    const applySort = (list) => {
        const copy = [...list];
        if (sortMode === 'name-asc') {
            copy.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortMode === 'name-desc') {
            copy.sort((a, b) => b.name.localeCompare(a.name));
        }
        return copy;
    };

    const sortedPersonal = applySort(filteredPersonal);
    const sortedFactions = applySort(filteredFactions);

    const visiblePersonal = showAll.personal
        ? sortedPersonal
        : sortedPersonal.slice(0, INITIAL_PERSONAL);

    const visibleFactions = showAll.faction
        ? sortedFactions
        : sortedFactions.slice(0, INITIAL_FACTION);

    const totalThreats = personalTargets.length + factionTargets.length;
    const totalEvidence = [...personalTargets, ...factionTargets].reduce(
        (sum, target) => sum + (target.evidence ? target.evidence.length : 0),
        0
    );
    const monitoredFactions = factionTargets.length;

    const resetVisibility = () => setShowAll({ personal: false, faction: false });

    const toggleReason = (cardKey) =>
        setExpandedReasons((prev) => ({ ...prev, [cardKey]: !prev[cardKey] }));

    const getReasonText = (target) => {
        if (target.reason) return target.reason; // custom reason (plain text)
        return target.reasonKey
            ? t(`kos.reasons.${target.reasonKey}`)
            : t('kos.reasons.reasonMissing');
    };

    const getEvidenceTitle = (ev) => {
        if (ev.title) return ev.title;
        if (ev.type === 'youtube') return t('kos.evidence.youtube');
        if (ev.type === 'medal') return t('kos.evidence.medal');
        if (ev.type === 'discord') return t('kos.evidence.discord');
        return t('kos.evidence.other');
    };

    // Wspólny upload pliku (picker plików ORAZ wklejenie obrazu ze schowka)
    const uploadEvidenceFile = async (file) => {
        if (!file) return;
        setUploading(true);
        setUploadError('');
        try {
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const res = await fetch('/api/upload-evidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: session?.access_token,
                    filename: file.name || 'dowod.png',
                    file_base64: base64
                })
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'UPLOAD_FAILED');
            }
            const line = `image|${data.url}`;
            setForm((f) => ({
                ...f,
                evidenceText: f.evidenceText.trim() ? `${f.evidenceText.trim()}\n${line}` : line
            }));
        } catch (err) {
            setUploadError(err.message || 'UPLOAD_FAILED');
        } finally {
            setUploading(false);
        }
    };

    const handleUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) uploadEvidenceFile(file);
        e.target.value = ''; // allow re-selecting the same file
    };

    // ⌨️ CROSS-PLATFORM: „Kopiuj obraz” na Discordzie wkłada do schowka
    // same piksele (nie link). Ctrl+V w polu dowodów = automatyczny upload
    // do Catbox i dopisanie linii image|<url>.
    const handleEvidencePaste = (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        let imageFile = null;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.kind === 'file' && it.type && it.type.startsWith('image/')) {
                imageFile = it.getAsFile();
                break;
            }
        }
        if (imageFile) {
            e.preventDefault();
            uploadEvidenceFile(imageFile);
        }
    };

    const renderEvidenceStrip = (target) => {
        const evidence = target.evidence || [];
        return (
            <div className="evidence-strip">
                {evidence.slice(0, 3).map((ev, i) =>
                    ev.type === 'image' ? (
                        <a
                            key={i}
                            href={ev.src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="evidence-thumb"
                            title={t('kos.evidence.images')}
                        >
                            <img src={ev.src} alt={`evidence-${i}`} loading="lazy" onError={onImageError} />
                        </a>
                ) : (
                    <a
                        key={i}
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`evidence-chip ${ev.type}`}
                        title={getEvidenceTitle(ev)}
                    >
                        <EvidenceIcon type={ev.type} />
                    </a>
                )
                )}
                {evidence.length > 3 && (
                    <span className="evidence-more">+{evidence.length - 3}</span>
                )}
            </div>
        );
    };

    const renderTargetCard = (target, sectionType, index) => {
        const cardKey = `${sectionType}-${target.name}`;
        const isExpanded = !!expandedReasons[cardKey];
        const reason = getReasonText(target);
        const showReasonToggle = reason.length > 55;

        return (
            <motion.div
                key={cardKey}
                className="kos-card"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                layout
            >
                <div className="card-top">
                    <div className="evidence-badge">
                        <Image size={12} />
                        <span>{t('kos.evidence.badge', { count: (target.evidence || []).length })}</span>
                    </div>
                    <div className="target-icon">
                        {sectionType === 'faction' ? (
                            <Building2 size={32} />
                        ) : (
                            <Target size={32} />
                        )}
                    </div>
                </div>

                <div className="card-body">
                    <h3 className="target-name">{target.name}</h3>
                    <div className="info-row">
                        <span className="info-label">{t('kos.reasonLabel')}:</span>
                        <span className={`info-val reason-text ${isExpanded ? '' : 'clamped'}`}>
                            {reason}
                        </span>
                    </div>
                    {showReasonToggle && (
                        <button
                            className="see-more-toggle"
                            onClick={() => toggleReason(cardKey)}
                        >
                            {isExpanded ? t('kos.seeLess') : t('kos.seeMore')}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                    {renderEvidenceStrip(target)}
                </div>

                <div className="card-footer">
                    <div className="card-footer-row">
                        <button
                            className="view-details-btn"
                            onClick={() => setSelectedTarget({ type: sectionType, ...target })}
                        >
                            <Eye size={14} />
                            <span>{t('kos.viewDossier')}</span>
                        </button>
                        <CopyNameButton name={target.name} />
                        {sectionType === 'personal' && target.robloxLink && (
                            <a
                                href={target.robloxLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="roblox-link-btn"
                                title={t('kos.intel.robloxProfile')}
                            >
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>
                </div>

                {/* HUD Decorations */}
                <div className="scan-line"></div>
                <div className="c-tl"></div><div className="c-tr"></div>
                <div className="c-bl"></div><div className="c-br"></div>
            </motion.div>
        );
    };

    const renderTargetGrid = (targets, sectionType) => (
        <motion.main
            className="kos-container"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 }
                }
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.05 }}
        >
            <div className="kos-grid">
                <AnimatePresence mode="popLayout">
                    {targets.map((target, index) => renderTargetCard(target, sectionType, index))}
                </AnimatePresence>
            </div>
        </motion.main>
    );

    const renderLoadMore = (sectionKey, filteredCount) => {
        if (filteredCount <= (sectionKey === 'personal' ? INITIAL_PERSONAL : INITIAL_FACTION)) {
            return null;
        }
        const isShown = showAll[sectionKey];
        return (
            <div className="load-more-wrap">
                <button
                    className="load-more-btn"
                    onClick={() => setShowAll((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                >
                    {isShown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isShown ? t('kos.showLess') : t('kos.showAll')}
                </button>
                <span className="showing-counter">
                    {isShown ? filteredCount : (sectionKey === 'personal' ? INITIAL_PERSONAL : INITIAL_FACTION)}
                    {' / '}{filteredCount}
                </span>
            </div>
        );
    };

    const renderNoResults = () => (
        <div className="no-results">
            <ShieldAlert size={48} />
            <p>{t('kos.noResults')}</p>
        </div>
    );

    const renderEvidenceSection = (evidence) => {
        const evs = evidence || [];
        const images = evs.filter((ev) => ev.type === 'image');
        const videos = evs.filter((ev) => ev.type !== 'image');
        return (
            <div className="evidence-section">
                <h4 className="evidence-title">
                    <Image size={14} />
                    {t('kos.evidence.title')}
                </h4>
                {images.length > 0 && (
                    <>
                        <span className="evidence-label">{t('kos.evidence.images')}</span>
                        <div className="evidence-gallery">
                            {images.map((ev, i) => (
                                <a
                                    key={i}
                                    href={ev.src}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="evidence-gallery-item"
                                >
                                    <img src={ev.src} alt={`screenshot-${i}`} loading="lazy" onError={onImageError} />
                                    <div className="evidence-zoom">
                                        <Search size={16} />
                                    </div>
                                </a>
                            ))}
                        </div>
                    </>
                )}
                {videos.length > 0 && (
                    <>
                        <span className="evidence-label">{t('kos.evidence.recordings')}</span>
                        <div className="evidence-videos">
                            {videos.map((ev, i) => (
                                <a
                                    key={i}
                                    href={ev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`evidence-video ${ev.type}`}
                                >
                                    <EvidenceIcon type={ev.type} size={16} />
                                    <span>{getEvidenceTitle(ev)}</span>
                                    <ExternalLink size={12} />
                                </a>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="kos-page">
            <Navbar />

            <div className="kos-overlay"></div>
            <div className="kos-scanlines"></div>

            {/* Hero Section */}
            <section className="kos-hero">
                <div className="hero-decoration">
                    <Skull size={16} className="hero-icon" />
                    <span className="hero-tag">THREAT_IDENTIFICATION_SYSTEM</span>
                </div>
                <h1 className="kos-title glitch-text" data-text={t('kos.title', 'KOS DATABASE')}>
                    <DecodedText text={t('kos.title', 'KOS DATABASE')} delay={0.2} />
                </h1>
                <p className="kos-subtitle">
                    {t('kos.subtitle', 'Official watchlist of individuals and entities posing a threat to Zjednoczona Polska Korona.')}
                </p>

                {/* Search & Stats Bar */}
                <div className="kos-dashboard">
                    <div className="stats-panel">
                        <div className="stat-item">
                            <span className="stat-label">{t('kos.stats.total')}</span>
                            <span className="stat-value">{totalThreats}</span>
                        </div>
                        <div className="stat-item highlight">
                            <span className="stat-label">{t('kos.stats.evidence')}</span>
                            <span className="stat-value">{totalEvidence}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">{t('kos.stats.monitored')}</span>
                            <span className="stat-value">{monitoredFactions}</span>
                        </div>
                    </div>

                    <div className="search-and-filters">
                        <div className="search-box">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder={t('kos.search')}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    resetVisibility();
                                }}
                            />
                        </div>

                        <div className="filter-tabs">
                            {['all', 'personal', 'faction'].map((filter) => (
                                <button
                                    key={filter}
                                    className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveFilter(filter);
                                        resetVisibility();
                                    }}
                                >
                                    {t(`kos.filters.${filter}`)}
                                </button>
                            ))}
                        </div>

                        <div className="sort-wrap">
                            <ArrowUpDown size={13} className="sort-icon" />
                            <select
                                className="sort-select"
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value)}
                                aria-label={t('kos.sort.label')}
                            >
                                <option value="default">{t('kos.sort.default')}</option>
                                <option value="name-asc">{t('kos.sort.nameAsc')}</option>
                                <option value="name-desc">{t('kos.sort.nameDesc')}</option>
                            </select>
                        </div>

                        {adminChecking ? (
                            <button className="manage-btn manage-btn-checking" disabled title={t('kos.manage.checking')}>
                                <Loader2 size={14} className="spin" />
                                <span>{t('kos.manage.checking')}</span>
                            </button>
                        ) : isAdmin ? (
                            <button className="manage-btn" onClick={() => setManageOpen(true)}>
                                <Database size={14} />
                                <span>{cloudReady === true ? t('kos.manage.openCloud') : t('kos.manage.open')}</span>
                            </button>
                        ) : (
                            <button
                                className="manage-btn manage-btn-locked"
                                disabled
                                title={t('kos.manage.adminOnly')}
                            >
                                <Lock size={14} />
                                <span>{t('kos.manage.adminOnly')}</span>
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* Combined/Filtered Sections */}
            {(activeFilter === 'all' || activeFilter === 'personal') && (
                <section className="kos-section">
                    <div className="section-header">
                        <h2>{t('kos.personalSection')}</h2>
                        <div className="section-divider"></div>
                    </div>
                    {filteredPersonal.length > 0 ? (
                        <>
                            {renderTargetGrid(visiblePersonal, 'personal')}
                            {renderLoadMore('personal', filteredPersonal.length)}
                        </>
                    ) : (
                        renderNoResults()
                    )}
                </section>
            )}

            {(activeFilter === 'all' || activeFilter === 'faction') && (
                <section className="kos-section">
                    <div className="section-header">
                        <h2>{t('kos.factionSection')}</h2>
                        <div className="section-divider"></div>
                    </div>
                    {filteredFactions.length > 0 ? (
                        <>
                            {renderTargetGrid(visibleFactions, 'faction')}
                            {renderLoadMore('faction', filteredFactions.length)}
                        </>
                    ) : (
                        renderNoResults()
                    )}
                </section>
            )}

            {/* Target Dossier Modal (personal + faction) */}
            <AnimatePresence>
                {selectedTarget && (
                    <motion.div
                        className="intel-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedTarget(null)}
                    >
                        <motion.div
                            className="intel-modal"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="intel-header">
                                {selectedTarget.type === 'faction' ? (
                                    <Building2 className="intel-icon" size={32} />
                                ) : (
                                    <User className="intel-icon" size={32} />
                                )}
                                <div>
                                    <h2 className="intel-title">{selectedTarget.name}</h2>
                                    <p className="intel-subtitle">
                                        {selectedTarget.type === 'faction'
                                            ? 'FACTION_DOSSIER'
                                            : 'PERSONAL_DOSSIER'}
                                    </p>
                                </div>
                            </div>

                            <div className="intel-grid">
                                {selectedTarget.type === 'faction' ? (
                                    <>
                                        <div className="intel-item">
                                            <span className="intel-label">{t('kos.intel.factionLeaders')}</span>
                                            <span className="intel-value">{selectedTarget.intel?.leaders ?? '???'}</span>
                                        </div>
                                        <div className="intel-item">
                                            <span className="intel-label">{t('kos.intel.allies')}</span>
                                            <span className="intel-value">{selectedTarget.intel?.allies ?? '???'}</span>
                                        </div>
                                        <div className="intel-item wide">
                                            <span className="intel-label">{t('kos.intel.firepower')}</span>
                                            <span className="intel-value">{selectedTarget.intel?.firepower ?? 'UNKNOWN'}</span>
                                        </div>
                                    </>
                                ) : null}
                                <div className="intel-item wide">
                                    <span className="intel-label">{t('kos.reasonLabel')}</span>
                                    <span className="intel-value">{getReasonText(selectedTarget)}</span>
                                </div>
                            </div>

                            {renderEvidenceSection(selectedTarget.evidence)}

                            {selectedTarget.type === 'personal' && (
                                <a
                                    href={selectedTarget.robloxLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="modal-profile-btn"
                                >
                                    <ExternalLink size={14} />
                                    <span>{t('kos.intel.robloxProfile')}</span>
                                </a>
                            )}

                            <button className="close-intel-btn" onClick={() => setSelectedTarget(null)}>
                                {t('kos.intel.close')}
                            </button>

                            <div className="intel-hud-corners">
                                <div className="h-tl"></div><div className="h-tr"></div>
                                <div className="h-bl"></div><div className="h-br"></div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Local Management Modal */}
            <AnimatePresence>
                {manageOpen && (
                    <motion.div
                        className="intel-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setManageOpen(false)}
                    >
                        <KOSManagePanel
                            cloudReady={cloudReady}
                            isAdmin={isAdmin}
                            manageTab={manageTab}
                            setManageTab={setManageTab}
                            form={form}
                            setForm={setForm}
                            personalTargets={personalTargets}
                            factionTargets={factionTargets}
                            handleAddTarget={handleAddTarget}
                            handleRemoveTarget={handleRemoveTarget}
                            handleResetLocal={handleResetLocal}
                            handleUpload={handleUpload}
                            handleEvidencePaste={handleEvidencePaste}
                            uploading={uploading}
                            uploadError={uploadError}
                            adminMessage={adminMessage}
                            getReasonText={getReasonText}
                            onClose={() => setManageOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="kos-footer">
                <div className="footer-deco">
                    <Cpu size={14} />
                    <span>SERVER_SCAN_MODE: ACTIVE</span>
                </div>
            </footer>
        </div>
    );
};

export default KOS;
