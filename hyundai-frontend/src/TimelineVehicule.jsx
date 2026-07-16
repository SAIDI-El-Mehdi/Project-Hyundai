import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Clock, UserCheck, Play, XCircle, Trophy, Undo2,
  Zap, Timer, ArrowDown, User
} from 'lucide-react';

// ─── Config visuelle par type d'action ───────────────────────────
const getStepConfig = (action = '') => {
  if (action.includes('Arrivée'))   return { icon: Clock,     bg: 'bg-amber-500',   ring: 'ring-amber-500/20',   glow: 'shadow-amber-500/25' };
  if (action.includes('Assigné'))   return { icon: UserCheck,  bg: 'bg-sky-500',     ring: 'ring-sky-500/20',     glow: 'shadow-sky-500/25' };
  if (action.includes('accepté'))   return { icon: Play,       bg: 'bg-emerald-500', ring: 'ring-emerald-500/20', glow: 'shadow-emerald-500/25' };
  if (action.includes('refusé'))    return { icon: XCircle,    bg: 'bg-red-500',     ring: 'ring-red-500/20',     glow: 'shadow-red-500/25' };
  if (action.includes('clôturée')) return { icon: Trophy,     bg: 'bg-violet-500',  ring: 'ring-violet-500/20',  glow: 'shadow-violet-500/25' };
  if (action.includes('Remis'))     return { icon: Undo2,      bg: 'bg-slate-500',   ring: 'ring-slate-500/20',   glow: 'shadow-slate-500/25' };
  return                                   { icon: Zap,        bg: 'bg-indigo-500',  ring: 'ring-indigo-500/20',  glow: 'shadow-indigo-500/25' };
};

// ─── Formateur de durée lisible ──────────────────────────────────
const formatDuration = (ms) => {
  if (!ms || ms < 0) return '--';
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

// ─── Couleur du chip de durée entre étapes ───────────────────────
const getDeltaColor = (ms) => {
  if (ms > 3600000) return 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
  if (ms > 900000)  return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
  return 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
};

// ─── Extracteur client / matricule (local au composant) ──────────
const extraireInfo = (str = '') => {
  if (!str) return { nom: 'Inconnu', matricule: 'N/A' };
  if (str.includes(' - ')) {
    const p = str.split(' - ');
    return { nom: p[0].trim(), matricule: p.slice(1).join(' - ').trim() };
  }
  const match = str.match(/^([^0-9]+)(.*)$/);
  if (match) return { nom: match[1].trim(), matricule: match[2].trim() || 'Non renseigné' };
  return { nom: str.trim(), matricule: 'Non renseigné' };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  COMPOSANT PRINCIPAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function TimelineVehicule({ ticket, onClose }) {
  const historique = ticket?.historique || [];
  const { nom, matricule } = extraireInfo(ticket?.client);

  // ── Calculs de durée & SLA ──
  const firstTime  = historique.length > 0 ? new Date(historique[0].horodatage) : null;
  const lastTime   = historique.length > 1 ? new Date(historique[historique.length - 1].horodatage) : null;
  const isClosed   = ticket && (ticket.statut === 'Clôturé' || ticket.statut === 'Refusé' || (ticket.statut || '').includes('Terminé'));
  const currentDuration = firstTime ? (isClosed && lastTime ? lastTime - firstTime : Date.now() - firstTime) : 0;

  const SLA_LIMIT  = 2 * 60 * 60 * 1000; // 2 heures
  const slaExceeded = currentDuration > SLA_LIMIT;
  const slaPercent  = Math.min(100, Math.round((currentDuration / SLA_LIMIT) * 100));

  return (
    <AnimatePresence>
      {ticket && (
        <>
          {/* ── Backdrop ─────────────────────────────────────── */}
          <motion.div
            key="tl-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
          />

          {/* ── Modal centré ─────────────────────────────────── */}
          <motion.div
            key="tl-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto">

              {/* ═══════ HEADER ═══════ */}
              <div className="p-6 pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-extrabold text-indigo-400 dark:text-indigo-500 uppercase tracking-[0.25em] mb-1.5">
                      Parcours du Véhicule
                    </p>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                      {nom}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        {matricule}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {ticket.intervention}
                      </span>
                      {ticket.conseiller && ticket.conseiller !== 'À assigner' && (
                        <>
                          <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <User size={11} /> {ticket.conseiller}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    <X size={18} className="text-slate-400" />
                  </button>
                </div>

                {/* ── Barre SLA ── */}
                <div className="mt-5 p-3.5 rounded-2xl border bg-white/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Timer size={12} className={!isClosed ? 'animate-pulse text-blue-500' : ''} />
                      {isClosed ? 'Durée Finale' : 'Durée en cours'}
                    </span>
                    <span className={`font-mono text-sm font-black ${slaExceeded ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatDuration(currentDuration)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${slaPercent}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                      className={`h-full rounded-full transition-colors ${
                        slaExceeded
                          ? 'bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                          : slaPercent > 75
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      }`}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600">0 min</span>
                    <span className={`text-[9px] font-extrabold ${slaExceeded ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                      {slaExceeded ? '⚠️ SLA Dépassé (> 2h)' : 'Objectif SLA : 2h'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ═══════ TIMELINE (scrollable) ═══════ */}
              <div className="flex-1 overflow-y-auto p-6">
                {historique.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                    <Clock size={40} className="mb-3 opacity-40" />
                    <p className="text-sm font-medium">Aucun historique disponible</p>
                    <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">Ce dossier a été créé avant l'activation du suivi.</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* ── Ligne verticale animée ── */}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ duration: 0.6 + historique.length * 0.15, ease: 'easeOut', delay: 0.2 }}
                      className="absolute left-[19px] top-5 bottom-0 w-[2px] bg-gradient-to-b from-slate-200 via-slate-200 to-transparent dark:from-slate-700 dark:via-slate-700 dark:to-transparent origin-top"
                    />

                    <div className="space-y-0">
                      {historique.map((event, index) => {
                        const config = getStepConfig(event.action);
                        const Icon = config.icon;
                        const time = new Date(event.horodatage);
                        const prevTime = index > 0 ? new Date(historique[index - 1].horodatage) : null;
                        const delta = prevTime ? time - prevTime : null;
                        const isLast = index === historique.length - 1;
                        const isActive = isLast && !isClosed;

                        return (
                          <motion.div
                            key={`step-${index}`}
                            initial={{ opacity: 0, x: -15 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + 0.18 * index, duration: 0.45, ease: 'easeOut' }}
                          >
                            {/* ── Chip durée inter-étapes ── */}
                            {delta !== null && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + 0.18 * index, duration: 0.3 }}
                                className="flex items-center gap-2.5 ml-[13px] py-1.5"
                              >
                                <div className="w-[14px] flex justify-center">
                                  <ArrowDown size={10} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDeltaColor(delta)}`}>
                                  + {formatDuration(delta)}
                                </span>
                              </motion.div>
                            )}

                            {/* ── Nœud d'étape ── */}
                            <div className="flex items-start gap-4 relative">
                              {/* Cercle icône */}
                              <div className={`relative z-10 w-10 h-10 rounded-full ${config.bg} ring-4 ${config.ring} flex items-center justify-center shadow-lg ${config.glow} flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}>
                                <Icon size={18} className="text-white" />
                              </div>

                              {/* Contenu textuel */}
                              <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-1'}`}>
                                <p className="font-bold text-[13px] text-slate-900 dark:text-white leading-tight">
                                  {event.action}
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                  {time.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {' à '}
                                  {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>

                                {/* Badge statut */}
                                <span className={`inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${
                                  event.statut === 'En cours'
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                                    : event.statut === 'Clôturé' || (event.statut || '').includes('Terminé')
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                      : event.statut === 'Refusé'
                                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}>
                                  {event.statut}
                                </span>

                                {/* Indicateur "en cours" sur la dernière étape active */}
                                {isActive && (
                                  <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="inline-block ml-2 text-[10px] font-bold text-blue-500 dark:text-blue-400"
                                  >
                                    ● En direct
                                  </motion.span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ═══════ FOOTER ═══════ */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {historique.length} étape{historique.length !== 1 ? 's' : ''} enregistrée{historique.length !== 1 ? 's' : ''}
                </p>
                <div className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                  isClosed
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                }`}>
                  {isClosed ? '✓ Terminé' : '◉ Actif'}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
