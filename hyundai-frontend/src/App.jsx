import { useEffect, useState, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { PieChart, Pie, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  Users, Clock, CheckCircle, Wrench, Search, Filter, ChevronLeft, ChevronRight, 
  Bot, FileSpreadsheet, Moon, Sun, Printer, LayoutGrid, List, TrendingUp,
  Bell, BellOff, ChevronDown, User, LogOut, Timer, Sparkles, AlertTriangle, Trophy,
  Maximize, Minimize, FileText, Mic, History, X, Undo2,
  Edit3, Trash2, Check, CheckSquare, XCircle, Calendar, ScanLine, 
  Smartphone, Send, MessageSquare, MonitorPlay, Activity, FilePlus, GitCommit
} from 'lucide-react';
import * as XLSX from 'xlsx'; 
import { jsPDF } from "jspdf";
import confetti from 'canvas-confetti';
import { Html5QrcodeScanner } from 'html5-qrcode';
import logoHyundai from './assets/logo.png';

const socket = io(); 

const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.src = url;
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img); img.onerror = (e) => reject(e);
  });
};

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator(); const gainNode = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch (e) { console.error("Audio non supporté", e); }
};

const highlightText = (text, highlight) => {
  if (!highlight || !highlight.trim()) return text;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? 
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-500/50 text-slate-900 dark:text-white rounded-sm px-0.5 shadow-sm">{part}</mark> : part
      )}
    </span>
  );
};

const parseDateFr = (str) => {
  try {
    if(!str) return new Date();
    if(str.includes('T')) return new Date(str); 
    const [d, t] = str.split(' ');
    const [day, mo, yr] = d.split('/');
    const [h, m, s] = (t||'00:00:00').split(':');
    return new Date(yr, mo-1, day, h, m, s);
  } catch(e) { return new Date(); }
};

const getTimeDiffStr = (start, end) => {
  const diffMs = Math.max(0, new Date(end) - new Date(start));
  if(diffMs < 60000) return "à l'instant";
  const totalMins = Math.floor(diffMs / 60000);
  if(totalMins < 60) return `+${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `+${h}h ${m}min`;
};

function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [status, setStatus] = useState('Recherche du serveur...');
  const [tickets, setTickets] = useState([]);
  const [client, setClient] = useState('');
  const [telephone, setTelephone] = useState('');
  const [intervention, setIntervention] = useState('Vidange Périodique');
  const [etapeLogin, setEtapeLogin] = useState(1);
  const [emailUtilisateur, setEmailUtilisateur] = useState('');
  const [codeSecret, setCodeSecret] = useState('');
  const [utilisateurConnecte, setUtilisateurConnecte] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('Tous');
  const [pageActuelle, setPageActuelle] = useState(1);
  const dossiersParPage = 5; 
  
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [vueAffichage, setVueAffichage] = useState('tableau');
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ongletActif, setOngletActif] = useState('tous');
  const [isTvMode, setIsTvMode] = useState(false);

  const [dateFiltre, setDateFiltre] = useState(new Date().toISOString().slice(0, 10));

  const [isListening, setIsListening] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activites, setActivites] = useState([]);

  const [isScanning, setIsScanning] = useState(false);
  const [ticketToCloture, setTicketToCloture] = useState(null);
  const [ticketToTimeline, setTicketToTimeline] = useState(null);

  const [idTicketEnCoursDEdit, setIdTicketEnCoursDEdit] = useState(null);
  const [valeurClientEdit, setValeurClientEdit] = useState('');
  const [valeurInterventionEdit, setValeurInterventionEdit] = useState('Vidange Périodique');

  const addActivite = (message, type = 'info') => {
    const newAct = { id: Date.now(), message, time: new Date(), type };
    setActivites(prev => [newAct, ...prev].slice(0, 50)); 
  };

  useEffect(() => {
    const bootTimer = setTimeout(() => setIsBooting(false), 1500); 
    return () => clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (theme === 'dark') { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [theme]);

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(
        (decodedText) => {
          setClient(decodedText); setIsScanning(false); scanner.clear();
          toast.success("Code scanné avec succès ! 📸", { duration: 3000 }); playNotificationSound();
        },
        (err) => {}
      );
      return () => { scanner.clear().catch(error => console.error("Failed to clear scanner", error)); };
    }
  }, [isScanning]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const toggleMute = () => {
    const newState = !isMuted; setIsMuted(newState); isMutedRef.current = newState;
    toast(newState ? 'Notifications silencieuses 🔕' : 'Son activé 🔔', { style: { borderRadius: '10px', background: theme === 'dark' ? '#334155' : '#fff', color: theme === 'dark' ? '#fff' : '#000' }});
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.log(err));
    } else {
      if (document.exitFullscreen) { document.exitFullscreen().then(() => setIsFullscreen(false)); }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return toast.error("La recherche vocale n'est pas supportée.");
    const recognition = new SpeechRecognition(); recognition.lang = 'fr-FR'; recognition.interimResults = false;
    recognition.onstart = () => { setIsListening(true); toast('Écoute en cours...', { icon: '🎙️' }); };
    recognition.onresult = (event) => { const transcript = event.results[0][0].transcript; setRecherche(transcript); setPageActuelle(1); toast.success(`Recherche : "${transcript}"`); };
    recognition.onerror = () => { setIsListening(false); }; recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  useEffect(() => {
    socket.on('connect', () => { setStatus('Connecté en direct'); addActivite("Connexion au serveur central établie.", "success"); });
    socket.on('disconnect', () => { setStatus('Hors ligne'); addActivite("Connexion perdue avec le serveur.", "danger"); });
    
    socket.on('ticket_recu', (nouveauTicket) => {
      setTickets((prev) => [nouveauTicket, ...prev]);
      toast('Nouveau véhicule à assigner !', { icon: '🚨', style: { borderRadius: '10px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }});
      addActivite(`Nouveau dossier créé : ${extraireClientMatricule(nouveauTicket.client).matricule}`, "info");
      if (!isMutedRef.current) playNotificationSound();
    });
    
    socket.on('historique_tickets', (historique) => { setTickets(historique); });
    
    socket.on('statut_modifie', (ticketModifie) => {
      setTickets((prev) => prev.map(t => {
        if (t.id === ticketModifie.id) {
          return { ...t, ...ticketModifie, heureCloture: ticketModifie.heureCloture || t.heureCloture };
        }
        return t;
      }));
      addActivite(`Dossier mis à jour: ${extraireClientMatricule(ticketModifie.client).matricule} ➔ ${ticketModifie.statut}`, "success");
    });

    socket.on('ticket_mis_a_jour_complet', (ticketMisAJour) => {
      setTickets((prev) => prev.map(t => t.id === ticketMisAJour.id ? ticketMisAJour : t));
      addActivite(`Dossier corrigé par l'accueil: ${extraireClientMatricule(ticketMisAJour.client).matricule}`, "info");
    });

    socket.on('ticket_supprime', (idSupprime) => {
      setTickets((prev) => prev.filter(t => t.id !== idSupprime));
      addActivite(`Un dossier a été supprimé par l'équipe.`, "danger");
    });

    return () => { 
      socket.off('connect'); socket.off('disconnect'); socket.off('ticket_recu'); 
      socket.off('historique_tickets'); socket.off('statut_modifie'); 
      socket.off('ticket_mis_a_jour_complet'); socket.off('ticket_supprime'); 
    };
  }, []);

  const demanderCode = (e) => {
    e.preventDefault(); if(!emailUtilisateur.includes('@')) return toast.error("Format d'email invalide.");
    toast.loading(`Envoi du code à ${emailUtilisateur}...`, { duration: 1500 });
    setTimeout(() => setEtapeLogin(2), 1500);
  };

  const verifierCode = (e) => {
    e.preventDefault(); if(codeSecret !== '1234') return toast.error("Code de sécurité invalide !");
    let role = ''; let nom = ''; const email = emailUtilisateur.toLowerCase();
    if (email.includes('hotesse')) { role = 'Hotesse'; nom = 'Service Accueil'; }
    else if (email.includes('marwa')) { role = 'Conseiller'; nom = 'Marwa'; }
    else if (email.includes('abdenacer') || email.includes('abdnacer')) { role = 'Conseiller'; nom = 'Abdenacer'; }
    else if (email.includes('salah') || email.includes('yallah') || email.includes('inge')) { role = 'Ingenieur'; nom = 'Salah-eddine'; }
    else { role = 'Hotesse'; nom = 'Utilisateur Anonyme'; } 
    setUtilisateurConnecte({ nom, role }); toast.success(`Authentification réussie : ${role}`);
    addActivite(`Connexion de ${nom} (${role})`, "info");
  };

  const deconnexion = () => {
    addActivite(`Déconnexion de ${utilisateurConnecte?.nom}`, "info");
    setUtilisateurConnecte(null); setEtapeLogin(1); setEmailUtilisateur(''); setCodeSecret('');
    setRecherche(''); setFiltreStatut('Tous'); setOngletActif('tous'); setPageActuelle(1); setVueAffichage('tableau'); setIsProfileOpen(false); setIsHistoryOpen(false); setIsTvMode(false);
  };

  const envoyerTicket = (e) => {
    e.preventDefault(); if(client.trim() === '') return toast.error('Veuillez renseigner le client.');
    const nouveauTicket = { 
      id: Date.now(), client, intervention, conseiller: 'À assigner', 
      heure: new Date().toLocaleString('fr-FR'), statut: 'En attente',
      telephone: telephone,
      historique: [{ statut: 'En attente', action: 'Création du dossier à l\'accueil', horodatage: new Date().toISOString() }] 
    };
    socket.emit('nouveau_ticket', nouveauTicket); setClient(''); setTelephone('');
    toast.success('Dossier envoyé en direct ! 🏁');
  };

  const assignerConseiller = (id, nomConseiller) => {
    socket.emit('assigner_conseiller', { id, conseiller: nomConseiller });
    toast.success(`Dossier assigné à ${nomConseiller}`);
  };
  
  const mettreAJourStatut = (id, nouveauStatut) => {
    let heureCloture = null;
    if (nouveauStatut === 'Clôturé' || nouveauStatut === 'Refusé' || nouveauStatut.includes('Terminé')) {
      heureCloture = new Date().toISOString();
      if (nouveauStatut === 'Clôturé' || nouveauStatut.includes('Terminé')) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#3b82f6', '#10b981', '#ffffff'] });
      }
    }
    socket.emit('modifier_statut', { id, nouveauStatut, heureCloture });
    
    setTickets(prev => prev.map(t => {
      if(t.id === id) {
        const hist = t.historique ? [...t.historique] : [];
        hist.push({ statut: nouveauStatut, action: `Passage à ${nouveauStatut}`, horodatage: new Date().toISOString() });
        return { ...t, statut: nouveauStatut, heureCloture: heureCloture || t.heureCloture, historique: hist };
      }
      return t;
    }));

    if(nouveauStatut === 'En cours') toast.success("Dossier Accepté ! ✓");
    if(nouveauStatut === 'Refusé') toast.error("Dossier Refusé ✕");
    if(nouveauStatut === 'Clôturé') toast.success("Dossier Clôturé avec succès ! 🏆");
  };

  const demanderCloture = (ticket) => {
    setTicketToCloture(ticket);
  };

  const confirmerCloture = (avecSms) => {
    if (!ticketToCloture) return;
    const { nom, matricule } = extraireClientMatricule(ticketToCloture.client);

    mettreAJourStatut(ticketToCloture.id, 'Clôturé');

    if (avecSms) {
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-slate-800 shadow-xl rounded-2xl pointer-events-auto flex border border-green-100 dark:border-green-900 overflow-hidden`}>
          <div className="w-1.5 h-full bg-green-500 absolute left-0 top-0"></div>
          <div className="flex-1 w-0 p-4 ml-1">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Redirection WhatsApp...
                </p>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium italic">
                    Ouverture de WhatsApp pour envoyer le message à {nom}.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex border-l border-slate-100 dark:border-slate-700">
            <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none p-4 flex items-center justify-center text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white focus:outline-none transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      ), { duration: 4000, position: 'bottom-right' });
      
      addActivite(`Notification WhatsApp préparée pour ${nom}.`, "success");

      const phone = ticketToCloture.telephone;
      if (phone) {
         const cleanPhone = phone.replace(/\s+/g, '').replace(/^0/, '212'); 
         const message = `*Hyundai Flux - Atelier*\n\nBonjour *${nom}*,\nL'intervention sur votre véhicule immatriculé *${matricule}* est terminée. ✅\n\nVous pouvez passer le récupérer à l'atelier.\nMerci de votre confiance !`;
         window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
      } else {
         toast.error("Aucun numéro de téléphone enregistré pour ce client.");
      }
    }

    setTicketToCloture(null);
  };

  const validerModificationHotesse = (id) => {
    if(valeurClientEdit.trim() === '') return toast.error("Le nom et matricule ne peuvent pas être vides.");
    const ticketModifie = { id, client: valeurClientEdit, intervention: valeurInterventionEdit };
    socket.emit('corriger_ticket_hotesse', ticketModifie);
    setTickets(prev => prev.map(t => t.id === id ? { ...t, client: valeurClientEdit, intervention: valeurInterventionEdit } : t));
    setIdTicketEnCoursDEdit(null);
    toast.success("Dossier corrigé avec succès ! ✨");
  };

  const supprimerTicketGlobale = (id) => {
    if(window.confirm("Voulez-vous vraiment supprimer définitivement ce dossier de tout le système ?")) {
      socket.emit('supprimer_ticket_globale', id);
      setTickets(prev => prev.filter(t => t.id !== id));
      toast.error("Dossier supprimé définitivement.");
    }
  };

  const handleDragStart = (e, ticketId) => { e.dataTransfer.setData('ticketId', ticketId.toString()); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, nouveauStatut) => {
    e.preventDefault(); const ticketId = parseInt(e.dataTransfer.getData('ticketId'), 10); const ticket = tickets.find(t => t.id === ticketId);
    if (ticket && utilisateurConnecte.role === 'Conseiller' && ticket.conseiller === utilisateurConnecte.nom) {
      if (nouveauStatut === 'Clôturé') {
        demanderCloture(ticket);
      } else {
        mettreAJourStatut(ticketId, nouveauStatut);
      }
    } else { toast.error("Action non autorisée."); }
  };

  const getBadgeClasses = (statut = '') => {
    if (statut === 'En attente') return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 shadow-sm';
    if (statut === 'En cours') return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 shadow-sm animate-pulse';
    if (statut === 'Refusé') return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 shadow-sm';
    if (statut.includes('Terminé') || statut === 'Clôturé') return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 shadow-sm font-extrabold';
    if (statut === 'Bloqué / Problème') return 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 shadow-sm animate-pulse';
    return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  const extraireClientMatricule = (infoStr = '') => {
    if (!infoStr) return { nom: 'Inconnu', matricule: 'N/A' };
    if (infoStr.includes(' - ')) { const parts = infoStr.split(' - '); return { nom: parts[0].trim(), matricule: parts.slice(1).join(' - ').trim() }; }
    const match = infoStr.match(/^([^0-9]+)(.*)$/); if (match) return { nom: match[1].trim(), matricule: match[2].trim() };
    return { nom: infoStr.trim(), matricule: 'Non renseigné' };
  };

  const getElapsedMs = (ticket) => {
    if (!ticket.heure || !ticket.heure.includes(' ')) return 0;
    const [datePart, timePart] = ticket.heure.split(' '); 
    const [day, month, year] = datePart.split('/'); 
    const [hours, minutes, seconds] = timePart.split(':');
    const ticketDate = new Date(year, month - 1, day, hours, minutes, seconds);
    
    let endTime = currentTime;
    if ((ticket.statut === 'Clôturé' || ticket.statut === 'Refusé' || (ticket.statut || '').includes('Terminé')) && ticket.heureCloture) {
      endTime = new Date(ticket.heureCloture);
    }
    return Math.max(0, endTime - ticketDate);
  };

  const formatMsToTime = (ms) => {
    if(ms === 0) return '--:--';
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const getElapsedTime = (ticket) => {
    const ms = getElapsedMs(ticket);
    if(ms === 0) return '--:--';
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const format = (val) => val.toString().padStart(2, '0');
    return h > 0 ? `${format(h)}:${format(m)}:${format(s)}` : `${format(m)}:${format(s)}`;
  };

  const genererPDF = async (ticket) => {
    const toastId = toast.loading('Création du Bon de Travail Premium...');
    try {
      const doc = new jsPDF(); const { nom, matricule } = extraireClientMatricule(ticket.client);
      doc.setFillColor(0, 44, 95); doc.rect(0, 0, 210, 42, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("ORDRE DE RÉPARATION", 195, 22, { align: "right" });
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Réf: BT-${ticket.id.toString().slice(-6)}   |   Date: ${ticket.heure || '-'}`, 195, 30, { align: "right" });
      try { const img = await loadImage(logoHyundai); doc.setFillColor(255, 255, 255); doc.roundedRect(15, 8, 45, 26, 2, 2, 'FD'); doc.addImage(img, 'PNG', 17, 10, 41, 22); } catch (err) {}
      
      doc.setDrawColor(0, 44, 95); doc.setFillColor(248, 250, 252); doc.roundedRect(15, 55, 180, 35, 2, 2, 'FD'); doc.setTextColor(0, 44, 95); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("1. INFORMATIONS CLIENT & VÉHICULE", 20, 63); doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.text("Client :", 20, 75); doc.setFont("helvetica", "normal"); doc.text(String(nom).toUpperCase(), 40, 75); doc.setFont("helvetica", "bold"); doc.text("Immatriculation :", 110, 75); doc.setFont("helvetica", "normal"); doc.text(String(matricule).toUpperCase(), 145, 75);
      
      doc.setFillColor(248, 250, 252); doc.roundedRect(15, 98, 180, 40, 2, 2, 'FD'); doc.setTextColor(0, 44, 95); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("2. DÉTAILS DE L'INTERVENTION", 20, 106); doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.text("Opération :", 20, 118); doc.setFont("helvetica", "normal"); doc.text(String(ticket.intervention) || '-', 45, 118); doc.setFont("helvetica", "bold"); doc.text("Assigné à :", 110, 118); doc.setFont("helvetica", "normal"); doc.text(String(ticket.conseiller) || '-', 135, 118); 
      
      doc.setFont("helvetica", "bold"); doc.setTextColor(0, 100, 0); doc.text("Temps d'Exécution Réel :", 20, 128); doc.setFont("helvetica", "normal"); doc.text(getElapsedTime(ticket), 65, 128); doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold"); doc.text("Statut Actuel :", 110, 128); doc.setFont("helvetica", "normal"); doc.text(String(ticket.statut) || '-', 135, 128);

      doc.roundedRect(15, 146, 180, 75, 2, 2, 'S'); doc.setFillColor(0, 44, 95); doc.rect(15, 146, 180, 12, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("3. RAPPORT TECHNIQUE & OBSERVATIONS", 20, 154); doc.setDrawColor(200, 200, 200); for(let i=0; i<5; i++) doc.line(20, 170 + (i * 10), 190, 170 + (i * 10));
      doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Visa et Signature du Client", 30, 235); doc.text("Cachet et Signature Atelier", 125, 235); doc.setDrawColor(0, 44, 95); doc.setLineDash([3, 3], 0); doc.roundedRect(20, 240, 70, 30, 2, 2, 'D'); doc.roundedRect(115, 240, 70, 30, 2, 2, 'D'); doc.setLineDash([], 0); 
      doc.setTextColor(150, 150, 150); doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.text(`Document certifié conforme - Hyundai Flux System le ${new Date().toLocaleDateString('fr-FR')}`, 105, 280, { align: "center" }); doc.text("Solutions Premium Propulsées par E.M.S. MechaTech", 105, 285, { align: "center" }); doc.save(`Ordre_Reparation_${String(matricule).replace(/ /g, '_').toUpperCase()}.pdf`); toast.success("Bon de travail Premium généré ! 🖨️", { id: toastId });
    } catch (error) { toast.error("Erreur PDF : " + error.message, { id: toastId }); }
  };

  const exporterRapportGlobalPDF = async () => {
    const targetDateStr = new Date(dateFiltre).toLocaleDateString('fr-FR');
    const ticketsExport = tickets.filter(t => (t.heure || '').startsWith(targetDateStr));

    if (ticketsExport.length === 0) return toast.error(`Aucun dossier à exporter pour le ${targetDateStr}.`);
    const toastId = toast.loading('Génération du rapport VIP en cours...');
    try {
      const doc = new jsPDF(); let yPos = 0; doc.setFillColor(0, 44, 95); doc.rect(0, 0, 210, 40, 'F');
      try { const img = await loadImage(logoHyundai); doc.setFillColor(255, 255, 255); doc.roundedRect(15, 8, 45, 24, 2, 2, 'FD'); doc.addImage(img, 'PNG', 17, 10, 41, 20); } catch (err) {}
      doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.text("RAPPORT D'ACTIVITÉ", 195, 18, { align: "right" }); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("ATELIER HYUNDAI FLUX", 195, 26, { align: "right" });
      doc.setTextColor(50, 50, 50); doc.setFontSize(10); doc.text(`Filtre Date : ${targetDateStr}`, 15, 50); doc.text(`Édité par : ${utilisateurConnecte.nom} (${utilisateurConnecte.role})`, 15, 56);
      doc.setFontSize(12); doc.setTextColor(0, 44, 95); doc.setFont("helvetica", "bold"); doc.text("SYNTHÈSE DES PERFORMANCES", 15, 70);
      const drawKPIBox = (x, title, value, color) => { doc.setDrawColor(220, 220, 220); doc.setFillColor(248, 250, 252); doc.roundedRect(x, 75, 40, 20, 2, 2, 'FD'); doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "normal"); doc.text(title, x + 20, 82, { align: "center" }); doc.setFontSize(14); doc.setTextColor(color[0], color[1], color[2]); doc.setFont("helvetica", "bold"); doc.text(String(value), x + 20, 90, { align: "center" }); };
      drawKPIBox(15, "Total", stats.total, [0, 44, 95]); drawKPIBox(60, "Acceptés", stats.acceptesJour, [16, 185, 129]); drawKPIBox(105, "Refusés", stats.refusesJour, [239, 68, 68]); drawKPIBox(150, "Réussite", `${stats.taux}%`, [139, 92, 246]);
      yPos = 115; doc.setFontSize(12); doc.setTextColor(0, 44, 95); doc.setFont("helvetica", "bold"); doc.text("DÉTAIL DES INTERVENTIONS", 15, yPos); yPos += 6;
      
      let currentY = yPos;
      const drawTableHeader = (y) => { doc.setFillColor(0, 44, 95); doc.rect(15, y, 180, 8, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("MATRICULE", 17, y + 5.5); doc.text("INTERVENTION", 55, y + 5.5); doc.text("RESP.", 105, y + 5.5); doc.text("DURÉE", 135, y + 5.5); doc.text("STATUT", 165, y + 5.5); return y + 8; }; currentY = drawTableHeader(currentY);
      
      ticketsExport.forEach((t, i) => { 
        if (currentY > 265) { doc.addPage(); currentY = 20; currentY = drawTableHeader(currentY); } 
        const { matricule } = extraireClientMatricule(t.client); 
        if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(15, currentY, 180, 8, 'F'); } 
        doc.setTextColor(50, 50, 50); doc.setFontSize(8); doc.setFont("helvetica", "normal"); 
        
        doc.text(String(matricule || 'N/A').substring(0,15), 17, currentY + 5.5); 
        doc.text(String(t.intervention || '').substring(0, 25), 55, currentY + 5.5); 
        doc.text(String(t.conseiller || '').substring(0, 10), 105, currentY + 5.5); 
        
        doc.setFont("helvetica", "bold"); doc.text(getElapsedTime(t), 135, currentY + 5.5); doc.setFont("helvetica", "normal");
        
        if ((t.statut || '').includes('Terminé') || t.statut === 'Clôturé') doc.setTextColor(16, 185, 129); 
        else if ((t.statut || '').includes('Bloqué') || t.statut === 'Refusé') doc.setTextColor(239, 68, 68); 
        else doc.setTextColor(245, 158, 11); 
        
        doc.setFont("helvetica", "bold"); 
        doc.text(String(t.statut || '').substring(0,18), 165, currentY + 5.5); 
        currentY += 8; 
      });
      
      const pageCount = doc.internal.getNumberOfPages(); for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFillColor(0, 44, 95); doc.rect(0, 282, 210, 15, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.text(`Document certifié conforme - Hyundai Flux System | Page ${i} sur ${pageCount}`, 105, 288, { align: "center" }); doc.setFont("helvetica", "bold"); doc.text("Premium Engineering Solutions by E.M.S. MechaTech © 2026", 105, 293, { align: "center" }); }
      doc.save(`Rapport_${dateFiltre}.pdf`); toast.success("Rapport filtré généré avec succès !", { id: toastId });
    } catch (error) { toast.error("Erreur PDF : " + error.message, { id: toastId }); }
  };

  const exportToExcel = () => {
    const targetDateStr = new Date(dateFiltre).toLocaleDateString('fr-FR');
    const ticketsExport = tickets.filter(t => (t.heure || '').startsWith(targetDateStr));

    if (ticketsExport.length === 0) return toast.error(`Aucun dossier à exporter pour le ${targetDateStr}.`);
    toast.loading('Génération Excel...', { duration: 1500 });
    const dataPourExcel = ticketsExport.map(t => {
      const { nom, matricule } = extraireClientMatricule(t.client); const dateComplete = (t.heure || '').split(' ');
      return { "Date d'Arrivée": dateComplete[0] || '', "Heure": dateComplete[1] || '', "Client": nom.toUpperCase(), "Matricule": matricule.toUpperCase(), "Téléphone": t.telephone || '', "Intervention": t.intervention || '', "Responsable": t.conseiller || '', "Statut": t.statut || '', "Durée Réelle": getElapsedTime(t) };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataPourExcel); worksheet['!cols'] = [ { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 } ];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Rapport"); XLSX.writeFile(workbook, `Hyundai_Excel_${dateFiltre}.xlsx`);
  };

  const stats = useMemo(() => {
    const targetDateStr = new Date(dateFiltre).toLocaleDateString('fr-FR');
    const ticketsFiltresDate = tickets.filter(t => (t.heure || '').startsWith(targetDateStr));

    const total = ticketsFiltresDate.length;
    const attente = ticketsFiltresDate.filter(t => (t.statut || '') === 'En attente').length;
    const termines = ticketsFiltresDate.filter(t => (t.statut || '').includes('Terminé') || t.statut === 'Clôturé').length;
    const taux = total === 0 ? 0 : Math.round((termines / total) * 100);

    const acceptesJour = ticketsFiltresDate.filter(t => t.statut === 'En cours' || (t.statut || '').includes('Terminé') || t.statut === 'Clôturé').length;
    const refusesJour = ticketsFiltresDate.filter(t => t.statut === 'Refusé').length;
    
    const marwaTicketsClotures = ticketsFiltresDate.filter(t => t.conseiller === 'Marwa' && ['Clôturé', 'Terminé'].some(s => (t.statut || '').includes(s)));
    const marwaAccepte = ticketsFiltresDate.filter(t => t.conseiller === 'Marwa' && ['En cours', 'Terminé', 'Clôturé'].some(s => (t.statut || '').includes(s))).length;
    const marwaRefuse = ticketsFiltresDate.filter(t => t.conseiller === 'Marwa' && t.statut === 'Refusé').length;
    const marwaMoyenneMs = marwaTicketsClotures.length > 0 ? (marwaTicketsClotures.reduce((acc, t) => acc + getElapsedMs(t), 0) / marwaTicketsClotures.length) : 0;

    const abdeTicketsClotures = ticketsFiltresDate.filter(t => t.conseiller === 'Abdenacer' && ['Clôturé', 'Terminé'].some(s => (t.statut || '').includes(s)));
    const abdeAccepte = ticketsFiltresDate.filter(t => t.conseiller === 'Abdenacer' && ['En cours', 'Terminé', 'Clôturé'].some(s => (t.statut || '').includes(s))).length;
    const abdeRefuse = ticketsFiltresDate.filter(t => t.conseiller === 'Abdenacer' && t.statut === 'Refusé').length;
    const abdeMoyenneMs = abdeTicketsClotures.length > 0 ? (abdeTicketsClotures.reduce((acc, t) => acc + getElapsedMs(t), 0) / abdeTicketsClotures.length) : 0;

    return { 
      total, attente, termines, taux, acceptesJour, refusesJour, 
      marwaAccepte, marwaRefuse, marwaMoyenne: formatMsToTime(marwaMoyenneMs),
      abdeAccepte, abdeRefuse, abdeMoyenne: formatMsToTime(abdeMoyenneMs)
    };
  }, [tickets, dateFiltre, currentTime]);

  const chartData = useMemo(() => {
    const dossiersActifs = tickets.filter(t => (t.statut || '') === 'En attente' || t.statut === 'En cours' || (t.statut || '') === 'Bloqué / Problème');
    return [
      { name: 'Marwa', value: dossiersActifs.filter(t => t.conseiller === 'Marwa').length, color: '#ec4899' }, 
      { name: 'Abdenacer', value: dossiersActifs.filter(t => t.conseiller === 'Abdenacer').length, color: '#3b82f6' }, 
      { name: 'À assigner', value: dossiersActifs.filter(t => t.conseiller === 'À assigner').length, color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [tickets]);

  const ticketsFilteredUI = useMemo(() => {
    const targetDateStr = new Date(dateFiltre).toLocaleDateString('fr-FR');
    return tickets.filter(t => {
      if (ongletActif === 'mes_dossiers' && t.conseiller !== utilisateurConnecte?.nom) return false;
      const clientStr = t.client || ''; const interStr = t.intervention || ''; const statStr = t.statut || '';
      const matchRecherche = clientStr.toLowerCase().includes(recherche.toLowerCase()) || interStr.toLowerCase().includes(recherche.toLowerCase());
      const matchStatut = filtreStatut === 'Tous' ? true : filtreStatut === 'Terminé' ? (statStr.includes('Terminé') || statStr === 'Clôturé') : statStr === filtreStatut;
      const matchDate = (t.heure || '').startsWith(targetDateStr);

      return matchRecherche && matchStatut && matchDate;
    });
  }, [tickets, recherche, filtreStatut, ongletActif, utilisateurConnecte, dateFiltre]);

  const totalPages = Math.ceil(ticketsFilteredUI.length / dossiersParPage) || 1;
  const indexDernierDossier = pageActuelle * dossiersParPage;
  const indexPremierDossier = indexDernierDossier - dossiersParPage;
  const dossiersAffiches = ticketsFilteredUI.slice(indexPremierDossier, indexDernierDossier);

  const isConnected = status.includes('Connecté');

  const activeHotesseEditMode = (ticket) => {
    setIdTicketEnCoursDEdit(ticket.id);
    setValeurClientEdit(ticket.client);
    setValeurInterventionEdit(ticket.intervention);
  };

  const renderKanbanCard = (t) => {
    const { nom, matricule } = extraireClientMatricule(t.client);
    const isAuthorizedToAction = utilisateurConnecte.role === 'Conseiller' && t.conseiller === utilisateurConnecte.nom;
    const isEditable = t.statut === 'En attente' || t.statut === 'Refusé';
    const isAssignable = t.statut === 'En attente' || t.statut === 'Refusé';

    return (
      <motion.div 
        key={t.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
        draggable={isAuthorizedToAction} onDragStart={(e) => handleDragStart(e, t.id)}
        className={`bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border transition-colors group ${isAuthorizedToAction ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''} border-slate-200 dark:border-slate-700`}
      >
        <div className="flex justify-between items-start">
          <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded transition-colors">{highlightText(matricule, recherche)}</span>
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${getBadgeClasses(t.statut)}`}>{t.statut || 'N/A'}</span>
        </div>
        <div>
          <h4 className="font-extrabold text-slate-900 dark:text-white uppercase transition-colors mt-2">{highlightText(nom, recherche)}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors mt-0.5">{highlightText(t.intervention, recherche) || '-'}</p>
        </div>
        
        <div className={`mt-3 p-2.5 rounded-lg border flex justify-between items-center ${['En cours'].includes(t.statut) ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-100 dark:bg-slate-900 dark:border-slate-700'}`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <Timer size={12} className={['En cours'].includes(t.statut) ? "text-blue-500 animate-pulse" : ""} /> Chrono
          </span>
          <span className="font-mono text-sm font-black text-slate-700 dark:text-slate-200">{getElapsedTime(t)}</span>
        </div>

        <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-100 dark:border-slate-700 transition-colors">
          {t.conseiller === 'À assigner' ? (
            <span className="text-xs font-bold text-amber-500 animate-pulse">⚠️ Non assigné</span>
          ) : (
            <span className={`text-xs font-bold flex items-center gap-1 ${t.conseiller === 'Marwa' ? 'text-pink-600 dark:text-pink-400' : 'text-blue-600 dark:text-blue-400'}`}><User size={12}/> {t.conseiller}</span>
          )}
          <div className="flex gap-1.5 flex-wrap justify-end">
            {(utilisateurConnecte.role === 'Ingenieur' || utilisateurConnecte.role === 'Conseiller') && (
              <button onClick={() => genererPDF(t)} className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md transition-all"><Printer size={14} /></button>
            )}
            
            {utilisateurConnecte.role === 'Ingenieur' && (
              <>
                <button onClick={() => setTicketToTimeline(t)} className="w-7 h-7 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-md transition-all shadow-sm group/btn" title="Traçabilité (Audit)"><Activity size={14} className="group-hover/btn:scale-110 transition-transform" /></button>
                <button onClick={() => supprimerTicketGlobale(t.id)} className="w-7 h-7 flex items-center justify-center bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-md transition-all shadow-sm group/btn" title="Supprimer définitivement"><Trash2 size={14} className="group-hover/btn:scale-110 transition-transform" /></button>
              </>
            )}

            {utilisateurConnecte.role === 'Hotesse' && (
              <div className={`flex gap-1 bg-slate-50 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700 ${!isAssignable ? 'opacity-50 grayscale' : ''}`}>
                <button disabled={!isAssignable} onClick={() => assignerConseiller(t.id, 'Marwa')} className={`px-2 py-1 rounded text-[10px] font-bold disabled:cursor-not-allowed ${t.conseiller === 'Marwa' ? 'bg-pink-500 text-white' : 'text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-slate-700'}`}>Marwa</button>
                <button disabled={!isAssignable} onClick={() => assignerConseiller(t.id, 'Abdenacer')} className={`px-2 py-1 rounded text-[10px] font-bold disabled:cursor-not-allowed ${t.conseiller === 'Abdenacer' ? 'bg-blue-500 text-white' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700'}`}>Abde</button>
              </div>
            )}
            {isAuthorizedToAction && (
              <div className="flex gap-1">
                {t.statut === 'En attente' && (
                  <>
                    <button onClick={() => mettreAJourStatut(t.id, 'En cours')} className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 hover:bg-green-500 hover:text-white rounded-md transition-all">Accepter</button>
                    <button onClick={() => mettreAJourStatut(t.id, 'Refusé')} className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 hover:bg-red-500 hover:text-white rounded-md transition-all">Refuser</button>
                  </>
                )}
                {t.statut === 'En cours' && (
                  <button onClick={() => demanderCloture(t)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm font-bold text-xs flex items-center gap-1"><CheckSquare size={14}/> Clôturer</button>
                )}
                {(t.statut === 'Clôturé' || t.statut === 'Refusé' || (t.statut || '').includes('Terminé')) && (
                  <button onClick={() => mettreAJourStatut(t.id, 'En attente')} className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-md hover:scale-105 transition-transform" title="Annuler"><Undo2 size={14} /></button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (isTvMode) {
    const tvAttente = tickets.filter(t => t.statut === 'En attente' || t.statut === 'Refusé');
    const tvEnCours = tickets.filter(t => t.statut === 'En cours');

    return (
      <div className="fixed inset-0 z-[100] bg-[#020617] text-white flex flex-col overflow-hidden font-sans">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shadow-2xl">
          <div className="flex items-center gap-6">
            <img src={logoHyundai} alt="logo" className="h-12 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
            <div>
              <h1 className="text-4xl font-black tracking-widest text-slate-100 uppercase">LIVE ATELIER <span className="text-blue-500">FLUX</span></h1>
              <p className="text-sm font-bold text-slate-400 tracking-[0.2em] mt-1">E.M.S. MECHATECH PREMIUM SYSTEM</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-5xl font-mono font-black text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              {currentTime.toLocaleTimeString('fr-FR')}
            </div>
            <button onClick={() => setIsTvMode(false)} className="p-4 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-lg hover:shadow-red-500/50">
              <X size={32} />
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-10 p-10 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617]">
          <div className="flex flex-col gap-6 overflow-hidden">
            <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl shadow-[0_0_30px_rgba(245,158,11,0.1)]">
              <h2 className="text-3xl font-black text-amber-500 flex items-center gap-4 uppercase tracking-wider"><Clock size={36}/> Véhicules en attente</h2>
              <span className="text-4xl font-black text-amber-400 bg-amber-500/20 px-6 py-2 rounded-2xl">{tvAttente.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar pb-10">
              <AnimatePresence>
                {tvAttente.map((t) => (
                  <motion.div layout initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={t.id} 
                    className="bg-slate-800/80 border-l-8 border-amber-500 p-6 rounded-2xl flex justify-between items-center shadow-lg">
                    <div>
                      <p className="text-5xl font-mono font-black text-white mb-3 tracking-wider">{extraireClientMatricule(t.client).matricule}</p>
                      <p className="text-2xl text-slate-300 font-bold uppercase">{extraireClientMatricule(t.client).nom} <span className="text-slate-500 mx-2">•</span> <span className="text-amber-400/80">{t.intervention}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-amber-400 mb-2">{getElapsedTime(t)}</p>
                      <div className="inline-flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
                        <User size={20} className="text-slate-400" />
                        <p className="text-xl text-slate-300 font-bold">{t.conseiller === 'À assigner' ? 'NON ASSIGNÉ' : t.conseiller}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {tvAttente.length === 0 && <div className="h-full flex items-center justify-center text-slate-600 text-2xl font-bold uppercase tracking-widest">Aucun véhicule en attente</div>}
            </div>
          </div>

          <div className="flex flex-col gap-6 overflow-hidden">
            <div className="flex justify-between items-center bg-blue-500/10 border border-blue-500/30 p-6 rounded-3xl shadow-[0_0_30px_rgba(59,130,246,0.1)]">
              <h2 className="text-3xl font-black text-blue-500 flex items-center gap-4 uppercase tracking-wider"><Wrench size={36}/> Interventions en cours</h2>
              <span className="text-4xl font-black text-blue-400 bg-blue-500/20 px-6 py-2 rounded-2xl">{tvEnCours.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar pb-10">
              <AnimatePresence>
                {tvEnCours.map((t) => (
                  <motion.div layout initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={t.id} 
                    className="bg-slate-800/80 border-l-8 border-blue-500 p-6 rounded-2xl flex justify-between items-center shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-blue-500/5 animate-pulse pointer-events-none"></div>
                    <div className="relative z-10">
                      <p className="text-5xl font-mono font-black text-white mb-3 tracking-wider">{extraireClientMatricule(t.client).matricule}</p>
                      <p className="text-2xl text-slate-300 font-bold uppercase">{extraireClientMatricule(t.client).nom} <span className="text-slate-500 mx-2">•</span> <span className="text-blue-400/80">{t.intervention}</span></p>
                    </div>
                    <div className="text-right relative z-10">
                      <p className="text-3xl font-black text-blue-400 mb-2">{getElapsedTime(t)}</p>
                      <div className="inline-flex items-center gap-2 bg-blue-900/50 px-4 py-2 rounded-xl border border-blue-500/30">
                        <User size={20} className="text-blue-300" />
                        <p className="text-xl text-blue-100 font-bold">{t.conseiller}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {tvEnCours.length === 0 && <div className="h-full flex items-center justify-center text-slate-600 text-2xl font-bold uppercase tracking-widest">Aucune intervention en cours</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isBooting) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#020617] to-[#020617]"></div>
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 2 }} className="z-10 text-6xl mb-6 shadow-blue-500/50 drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">🚙</motion.div>
        <h1 className="z-10 text-3xl font-extrabold text-white tracking-[0.2em] mb-4">HYUNDAI FLUX</h1>
        <div className="z-10 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.2 }} className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></motion.div>
        </div>
        <p className="z-10 mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse">Initialisation des systèmes E.M.S...</p>
      </div>
    );
  }

  if (!utilisateurConnecte) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-slate-200 to-slate-300 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 font-sans transition-colors duration-300">
        <Toaster />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/50 dark:border-slate-800 w-full max-w-md transition-colors duration-300">
          <div className="flex justify-between items-start mb-6">
            <div className="h-20 w-20 bg-slate-900 dark:bg-slate-800 rounded-2xl shadow-lg flex items-center justify-center text-4xl mx-auto ml-24 border border-slate-700">🚙</div>
            <button onClick={toggleTheme} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white text-center mb-2 tracking-tight transition-colors">Portail Hyundai</h2>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8 font-medium transition-colors">Système de gestion des flux atelier</p>
          {etapeLogin === 1 ? (
            <form onSubmit={demanderCode} className="space-y-5">
              <input type="email" required value={emailUtilisateur} onChange={(e) => setEmailUtilisateur(e.target.value)} placeholder="Email Professionnel" className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all font-medium" />
              <button type="submit" className="w-full py-4 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-xl font-bold tracking-wide shadow-lg transition-all hover:-translate-y-0.5">Recevoir le code d'accès</button>
            </form>
          ) : (
            <form onSubmit={verifierCode} className="space-y-5">
              <input type="password" required value={codeSecret} onChange={(e) => setCodeSecret(e.target.value)} placeholder="Code SMS (1234)" className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-4 focus:ring-blue-500/20 outline-none text-center tracking-[1em] text-2xl font-bold transition-all" />
              <button type="submit" className="w-full py-4 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white rounded-xl font-bold tracking-wide shadow-lg transition-all hover:-translate-y-0.5">Ouvrir la session</button>
              <button type="button" onClick={() => setEtapeLogin(1)} className="w-full py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">← Retour</button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#020617] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 relative">
      <Toaster />
      
      <AnimatePresence>
        {isScanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2"><ScanLine size={20} className="text-blue-500" /> Scanner un Code</h3>
                 <button onClick={() => setIsScanning(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={18} /></button>
               </div>
               <div id="reader" className="w-full rounded-xl overflow-hidden border-2 border-dashed border-blue-500/50 bg-black min-h-[250px]"></div>
               <p className="text-xs text-center text-slate-500 mt-4">Placez le QR Code de la carte grise devant la caméra ou cliquez sur "Scan an Image File".</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ticketToCloture && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700">
               <div className="flex justify-between items-center mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
                 <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2"><Smartphone size={22} className="text-blue-500" /> Notification Client</h3>
                 <button onClick={() => setTicketToCloture(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={18} /></button>
               </div>
               
               <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                 <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Aperçu du message WhatsApp</p>
                 <p className="text-sm font-medium text-slate-800 dark:text-slate-200 italic">
                   "Bonjour <span className="font-bold text-slate-900 dark:text-white">{extraireClientMatricule(ticketToCloture.client).nom}</span>, l'intervention sur votre véhicule <span className="font-bold text-slate-900 dark:text-white">{extraireClientMatricule(ticketToCloture.client).matricule}</span> est terminée. Vous pouvez passer le récupérer à l'atelier."
                 </p>
                 <p className="text-[10px] text-green-600 font-bold mt-2 border-t border-slate-200 dark:border-slate-600 pt-1">
                   Numéro : {ticketToCloture.telephone || 'Non renseigné'}
                 </p>
               </div>

               <p className="text-sm text-center font-bold text-slate-700 dark:text-slate-300 mb-6">Voulez-vous ouvrir WhatsApp pour envoyer ce message ?</p>

               <div className="flex gap-3">
                 <button onClick={() => confirmerCloture(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all text-sm">
                   Non, juste clôturer
                 </button>
                 <button onClick={() => confirmerCloture(true)} className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/30 hover:-translate-y-0.5">
                   <Send size={16} /> Ouvrir WhatsApp
                 </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ticketToTimeline && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTicketToTimeline(null)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70]"></motion.div>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-[80] flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><Activity className="text-indigo-500" size={20}/> Traçabilité (Audit)</h3>
                  <p className="text-xs font-mono font-bold mt-1 text-slate-500">{extraireClientMatricule(ticketToTimeline.client).matricule}</p>
                </div>
                <button onClick={() => setTicketToTimeline(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={18}/></button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto space-y-2">
                {(() => {
                  let hist = ticketToTimeline.historique;
                  if (!hist || hist.length === 0) {
                    const tDate = parseDateFr(ticketToTimeline.heure);
                    hist = [{ statut: 'En attente', action: "Création du dossier à l'accueil", horodatage: tDate.toISOString() }];
                    if (ticketToTimeline.statut !== 'En attente') {
                      hist.push({ statut: ticketToTimeline.statut, action: `Passage à ${ticketToTimeline.statut}`, horodatage: ticketToTimeline.heureCloture || new Date().toISOString() });
                    }
                  }
                  
                  return hist.map((event, idx) => {
                    const prev = idx > 0 ? hist[idx-1] : null;
                    const delay = prev ? getTimeDiffStr(prev.horodatage, event.horodatage) : null;
                    
                    let IconComponent = GitCommit;
                    let colorClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                    
                    if (event.statut === 'En attente') { IconComponent = FilePlus; colorClass = "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"; }
                    else if (event.statut === 'En cours') { IconComponent = Wrench; colorClass = "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"; }
                    else if (event.statut === 'Refusé') { IconComponent = XCircle; colorClass = "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"; }
                    else if ((event.statut || '').includes('Terminé') || event.statut === 'Clôturé') { IconComponent = CheckCircle; colorClass = "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"; }

                    return (
                      <div className="flex gap-4 relative" key={idx}>
                        {idx !== hist.length - 1 && <div className="absolute top-8 left-[19px] bottom-[-16px] w-0.5 bg-slate-200 dark:bg-slate-700"></div>}
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white dark:border-slate-900 ${colorClass}`}>
                            <IconComponent size={16} />
                          </div>
                        </div>
                        <div className="flex-1 pb-6 pt-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{event.action || event.statut}</p>
                              <p className="text-xs font-medium text-slate-500">{new Date(event.horodatage).toLocaleTimeString('fr-FR')}</p>
                            </div>
                            {delay && <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">{delay}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"></motion.div>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-bold text-lg flex items-center gap-2"><History className="text-blue-500" size={20}/> Audit & Activités</h3>
                <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={18}/></button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {activites.length === 0 ? ( <p className="text-center text-sm text-slate-400 mt-10">Aucune activité récente.</p> ) : (
                  activites.map((act) => (
                    <div key={act.id} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                      <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${act.type === 'success' ? 'bg-emerald-500' : act.type === 'danger' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                      <p className="text-[10px] font-bold text-slate-400 mb-1">{act.time.toLocaleTimeString('fr-FR')}</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{act.message}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 p-4 px-6 flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 transition-colors relative z-30">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-xl shadow-md flex items-center justify-center text-2xl">🚙</div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">Hyundai Flux</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="relative flex h-2.5 w-2.5">{isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}<span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span></span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">{status}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 px-6 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Heure Locale (Atelier)</span>
          <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">{currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>

        <div className="flex items-center gap-4 relative">
          <button onClick={() => setIsTvMode(true)} className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors shadow-sm" title="Mode TV Atelier">
            <MonitorPlay size={18} />
          </button>
          
          {(utilisateurConnecte.role === 'Conseiller' || utilisateurConnecte.role === 'Ingenieur') && (
            <button onClick={() => setIsHistoryOpen(true)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Historique d'Activité">
              <History size={18} />
            </button>
          )}
          <button onClick={toggleFullscreen} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title={isFullscreen ? "Quitter plein écran" : "Plein écran"}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button onClick={toggleMute} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors relative">
            {isMuted ? <BellOff size={18} className="text-slate-400" /> : <Bell size={18} className="text-amber-500" />}
          </button>
          <button onClick={toggleTheme} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>
          <div className="relative">
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 p-1.5 pr-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-full transition-all">
              <div className="h-9 w-9 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center shadow-sm"><User size={18} /></div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight transition-colors">{utilisateurConnecte.nom}</p>
                <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider transition-colors">{utilisateurConnecte.role}</p>
              </div>
              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute right-0 mt-3 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-700/60 overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Compte actif</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{emailUtilisateur || 'user@hyundai.com'}</p>
                  </div>
                  <div className="p-2">
                    <button onClick={deconnexion} className="w-full px-4 py-2.5 text-left text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl flex items-center gap-3 transition-colors group"><LogOut size={16} className="group-hover:scale-110 transition-transform" /> Se déconnecter</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.nav>

      {/* ================================================== */}
      {/* HÔTESSE SECTION */}
      {/* ================================================== */}
      {utilisateurConnecte.role === 'Hotesse' && (
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-full xl:w-1/3 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 p-6 md:p-8 transition-colors h-fit">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 transition-colors"><span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 p-2 rounded-lg transition-colors">📝</span> Créer un dossier</h2>
            <form onSubmit={envoyerTicket} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 transition-colors">Client & Matricule</label>
                <div className="relative">
                  <input type="text" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ex: Hassan - 1234 A 50" className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 outline-none transition-colors font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" />
                  <button type="button" onClick={() => setIsScanning(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition-colors" title="Scanner QR Code">
                    <ScanLine size={16} />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 transition-colors">Téléphone (Optionnel)</label>
                <input type="text" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex: 06 12 34 56 78" className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 outline-none transition-colors font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 transition-colors">Type d'Intervention</label>
                <select value={intervention} onChange={(e) => setIntervention(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-500 outline-none transition-colors font-medium text-slate-900 dark:text-white cursor-pointer">
                  <option value="Vidange Périodique">Vidange Périodique</option>
                  <option value="Inspection Générale">Inspection Générale</option>
                  <option value="Problème Mécanique">Problème Mécanique</option>
                </select>
              </div>
              <button type="submit" disabled={!isConnected} className="w-full py-4 mt-4 bg-slate-900 dark:bg-blue-600 disabled:bg-slate-400 dark:disabled:bg-slate-700 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-xl font-bold tracking-wide shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2">Transmettre à l'Atelier <span>🏁</span></button>
            </form>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30 dark:bg-slate-800/30">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg">🛡️</span> Suivi & Corrections</h2>
                <p className="text-xs text-slate-400 mt-1">Vérifiez et modifiez les dossiers avant traitement par l'équipe.</p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar size={16} className="text-slate-400"/>
                  <input type="date" value={dateFiltre} onChange={(e) => {setDateFiltre(e.target.value); setPageActuelle(1);}} className="bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none cursor-pointer" title="Filtrer par date" />
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Filtrer mes saisies..." value={recherche} onChange={(e) => setRecherche(e.target.value)} className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto min-h-[300px]">
              {ticketsFilteredUI.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-8"><Sparkles size={40} className="mb-2 opacity-30 text-blue-500" /><p className="text-sm font-medium">Aucun véhicule enregistré pour cette date.</p></div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-4 pl-6">Arrivée</th><th className="p-4">Détails Véhicule</th><th className="p-4">Intervention</th><th className="p-4 text-center">État Atelier</th><th className="p-4 text-center">Actions Correctives</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-sm">
                    {ticketsFilteredUI.map((t) => {
                      const { nom, matricule } = extraireClientMatricule(t.client);
                      const isEditable = t.statut === 'En attente' || t.statut === 'Refusé';
                      const isAssignable = t.statut === 'En attente' || t.statut === 'Refusé';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-4 pl-6 font-medium text-slate-500 dark:text-slate-400">{t.heure ? t.heure.split(' ')[1] : '--:--'}</td>
                          <td className="p-4">
                            {idTicketEnCoursDEdit === t.id ? (
                              <input type="text" value={valeurClientEdit} onChange={(e) => setValeurClientEdit(e.target.value)} className="px-3 py-1.5 w-full bg-slate-50 dark:bg-slate-800 border border-blue-500 rounded-lg outline-none font-bold text-slate-900 dark:text-white" />
                            ) : (
                              <div><span className="px-2 py-0.5 mr-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{highlightText(matricule, recherche)}</span><span className="font-bold text-slate-900 dark:text-white uppercase">{highlightText(nom, recherche)}</span></div>
                            )}
                          </td>
                          <td className="p-4">
                            {idTicketEnCoursDEdit === t.id ? (
                              <select value={valeurInterventionEdit} onChange={(e) => setValeurInterventionEdit(e.target.value)} className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-blue-500 rounded-lg outline-none text-xs font-semibold">
                                <option value="Vidange Périodique">Vidange Périodique</option>
                                <option value="Inspection Générale">Inspection Générale</option>
                                <option value="Problème Mécanique">Problème Mécanique</option>
                              </select>
                            ) : ( <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.intervention}</span> )}
                          </td>
                          <td className="p-4 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getBadgeClasses(t.statut)}`}>{t.statut}</span></td>
                          <td className="p-4 text-center">
                            <div className="flex gap-2 justify-center items-center">
                              {idTicketEnCoursDEdit === t.id ? (
                                <>
                                  <button onClick={() => validerModificationHotesse(t.id)} className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-lg shadow-sm hover:bg-emerald-600"><Check size={16} /></button>
                                  <button onClick={() => setIdTicketEnCoursDEdit(null)} className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg border border-slate-200 dark:border-slate-700"><X size={16} /></button>
                                </>
                              ) : (
                                <>
                                  <div className={`flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 mr-2 ${!isAssignable ? 'opacity-50 grayscale' : ''}`}>
                                    <button disabled={!isAssignable} onClick={() => assignerConseiller(t.id, 'Marwa')} className={`px-2 py-1 text-[10px] font-bold rounded disabled:cursor-not-allowed ${t.conseiller === 'Marwa' ? 'bg-pink-500 text-white' : 'text-pink-600 hover:bg-pink-50 dark:hover:bg-slate-700'}`}>Marwa</button>
                                    <button disabled={!isAssignable} onClick={() => assignerConseiller(t.id, 'Abdenacer')} className={`px-2 py-1 text-[10px] font-bold rounded disabled:cursor-not-allowed ${t.conseiller === 'Abdenacer' ? 'bg-blue-500 text-white' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700'}`}>Abde</button>
                                  </div>
                                  <button disabled={!isEditable} onClick={() => activeHotesseEditMode(t)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"><Edit3 size={14} /></button>
                                  <button disabled={!isEditable} onClick={() => supprimerTicketGlobale(t.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-100"><Trash2 size={14} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ================================================== */}
      {/* CONSEILLER / INGENIEUR SECTION */}
      {/* ================================================== */}
      {(utilisateurConnecte.role === 'Conseiller' || utilisateurConnecte.role === 'Ingenieur') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto w-full flex flex-col gap-6">
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center gap-4 transition-colors relative overflow-hidden">
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl transition-colors"><Wrench size={24} /></div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total dossiers</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center gap-4 transition-colors relative overflow-hidden">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl transition-colors"><CheckSquare size={24} /></div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Acceptés (Filtre)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.acceptesJour}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center gap-4 transition-colors relative overflow-hidden">
              <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl transition-colors"><XCircle size={24} /></div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Refusés (Filtre)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.refusesJour}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex items-center gap-4 transition-colors relative overflow-hidden">
              <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl transition-colors"><CheckCircle size={24} /></div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Clôturés Total</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.termines}</p>
              </div>
            </div>
          </div>

          {utilisateurConnecte.role === 'Ingenieur' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 transition-colors relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp size={20} className="text-indigo-500" /> Bilan par Conseiller (Analytics)
                </h3>
                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">Sélection Active</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/10 dark:to-slate-800/50 border border-pink-100 dark:border-pink-500/20 p-5 rounded-2xl flex justify-between items-center shadow-sm relative">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-pink-500 text-white rounded-full flex items-center justify-center font-black text-xl shadow-md shadow-pink-500/30">M</div>
                    <div>
                      <p className="font-extrabold text-pink-700 dark:text-pink-400 text-lg">Marwa</p>
                      <p className="text-xs font-medium text-pink-600/70 dark:text-pink-400/70">Conseillère technique</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.marwaAccepte}</p>
                      <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase">Acceptés</p>
                    </div>
                    <div className="text-center bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-red-100 dark:border-red-500/20 shadow-sm">
                      <p className="text-2xl font-black text-red-600 dark:text-red-400">{stats.marwaRefuse}</p>
                      <p className="text-[10px] font-bold text-red-600/70 dark:text-red-400/70 uppercase">Refusés</p>
                    </div>
                  </div>
                  <div className="absolute top-2 right-4 flex items-center gap-1 opacity-70">
                    <Timer size={12} className="text-slate-500"/> <span className="text-[10px] font-bold text-slate-500">Moy: {stats.marwaMoyenne}</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-slate-800/50 border border-blue-100 dark:border-blue-500/20 p-5 rounded-2xl flex justify-between items-center shadow-sm relative">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center font-black text-xl shadow-md shadow-blue-500/30">A</div>
                    <div>
                      <p className="font-extrabold text-blue-700 dark:text-blue-400 text-lg">Abdenacer</p>
                      <p className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70">Conseiller technique</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.abdeAccepte}</p>
                      <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase">Acceptés</p>
                    </div>
                    <div className="text-center bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-red-100 dark:border-red-500/20 shadow-sm">
                      <p className="text-2xl font-black text-red-600 dark:text-red-400">{stats.abdeRefuse}</p>
                      <p className="text-[10px] font-bold text-red-600/70 dark:text-red-400/70 uppercase">Refusés</p>
                    </div>
                  </div>
                  <div className="absolute top-2 right-4 flex items-center gap-1 opacity-70">
                    <Timer size={12} className="text-slate-500"/> <span className="text-[10px] font-bold text-slate-500">Moy: {stats.abdeMoyenne}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {utilisateurConnecte.role === 'Ingenieur' && chartData.reduce((acc, curr) => acc + curr.value, 0) > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row items-center gap-8 transition-colors relative overflow-hidden">
              <div className="w-full md:w-1/3">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Users size={16}/> Répartition Équipe</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Dossiers actifs par technicien</p>
                <div className="space-y-3">
                  {chartData.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span><span className="text-sm font-bold text-slate-700 dark:text-slate-300">{entry.name}</span></div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full md:w-2/3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', color: theme === 'dark' ? '#fff' : '#000', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30 dark:bg-slate-800/30 transition-colors">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 transition-colors"><span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg transition-colors">⚙️</span> Interventions</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                
                {(utilisateurConnecte.role === 'Conseiller') && (
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 mr-2">
                    <button onClick={() => setOngletActif('tous')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${ongletActif === 'tous' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Tous</button>
                    <button onClick={() => setOngletActif('mes_dossiers')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${ongletActif === 'mes_dossiers' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Mes Dossiers</button>
                  </div>
                )}

                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
                  <Calendar size={16} className="text-slate-400"/>
                  <input type="date" value={dateFiltre} onChange={(e) => {setDateFiltre(e.target.value); setPageActuelle(1);}} className="bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none cursor-pointer" title="Filtrer l'historique par date" />
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                  <button onClick={() => setVueAffichage('tableau')} className={`p-1.5 rounded-md transition-all ${vueAffichage === 'tableau' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="Vue Tableau"><List size={18} /></button>
                  <button onClick={() => setVueAffichage('kanban')} className={`p-1.5 rounded-md transition-all ${vueAffichage === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="Vue Kanban"><LayoutGrid size={18} /></button>
                </div>
                
                <div className="relative flex items-center">
                  <Search className="absolute left-3 text-slate-400 dark:text-slate-500" size={18} />
                  <input type="text" placeholder="Chercher matricule..." value={recherche} onChange={(e) => {setRecherche(e.target.value); setPageActuelle(1);}} className="pl-10 pr-10 py-2 w-full sm:w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-colors" />
                  <button onClick={startVoiceSearch} className={`absolute right-2 p-1.5 rounded-md transition-colors ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`} title="Recherche vocale"><Mic size={16} /></button>
                </div>

                {vueAffichage === 'tableau' && (
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <select value={filtreStatut} onChange={(e) => {setFiltreStatut(e.target.value); setPageActuelle(1);}} className="pl-10 pr-8 py-2 w-full sm:w-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white cursor-pointer appearance-none transition-colors">
                      <option value="Tous">Tous</option>
                      <option value="En attente">⏳ Attente</option>
                      <option value="Terminé">✅ Terminés</option>
                      <option value="Bloqué / Problème">❌ Bloqués</option>
                    </select>
                  </div>
                )}
                {(utilisateurConnecte.role === 'Ingenieur' || utilisateurConnecte.role === 'Conseiller') && (
                  <div className="flex gap-2">
                    <button onClick={exportToExcel} className="p-2 px-3 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm" title={`Exporter Excel (${dateFiltre})`}><FileSpreadsheet size={16}/></button>
                    <button onClick={exporterRapportGlobalPDF} className="p-2 px-3 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm" title={`Rapport PDF (${dateFiltre})`}><FileText size={16}/> Rapport</button>
                  </div>
                )}
              </div>
            </div>
            
            {vueAffichage === 'tableau' ? (
              <div className="overflow-x-auto min-h-[300px]">
                {dossiersAffiches.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 transition-colors"><Search size={48} className="mb-4 opacity-20" /><p className="text-lg font-medium">Aucun résultat</p></div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors font-bold text-xs text-slate-400 uppercase tracking-wider">
                        <th className="p-4 pl-6">Arrivée</th>
                        <th className="p-4">Véhicule & Panne</th>
                        <th className="p-4">Resp.</th>
                        <th className="p-4 text-center">Chrono</th>
                        <th className="p-4 text-center">État</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 transition-colors text-sm">
                      <AnimatePresence>
                        {dossiersAffiches.map((t) => {
                          const { nom, matricule } = extraireClientMatricule(t.client);
                          const isAuthorizedToAction = utilisateurConnecte.role === 'Conseiller' && t.conseiller === utilisateurConnecte.nom;
                          const heureStr = t.heure || ''; const timeAff = heureStr.includes(' ') ? heureStr.split(' ')[1] : '--:--'; const dateAff = heureStr.includes(' ') ? heureStr.split(' ')[0] : 'N/A';

                          return (
                            <motion.tr key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                              className="hover:bg-slate-50/50 dark:bg-slate-800/30 transition-colors group">
                              <td className="p-4 pl-6">
                                <span className="text-sm font-medium px-2 py-1 rounded-md transition-colors text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">{timeAff}</span>
                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">{dateAff}</div>
                              </td>
                              <td className="p-4">
                                <p className="font-bold text-slate-900 dark:text-white uppercase">{highlightText(nom, recherche)}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                    {highlightText(matricule, recherche)}
                                  </span>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">{highlightText(t.intervention, recherche) || '-'}</p>
                                </div>
                              </td>
                              <td className="p-4">
                                {t.conseiller === 'À assigner' ? (
                                  <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold animate-pulse transition-colors">⚠️ À assigner</span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${t.conseiller === 'Marwa' ? 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'}`}>👤 {t.conseiller}</span>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${['En cours'].includes(t.statut) ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                  <Timer size={16} className={['En cours'].includes(t.statut) ? "text-blue-500 animate-pulse" : "text-slate-400"} />
                                  <span className="font-mono text-sm font-black text-slate-700 dark:text-slate-200 tracking-wider">{getElapsedTime(t)}</span>
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${getBadgeClasses(t.statut)}`}>{t.statut || '-'}</span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex gap-2 justify-center items-center">
                                  {(utilisateurConnecte.role === 'Ingenieur' || utilisateurConnecte.role === 'Conseiller') && (
                                    <button onClick={() => genererPDF(t)} className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all shadow-sm group/btn" title="Imprimer"><Printer size={16} className="group-hover/btn:scale-110 transition-transform" /></button>
                                  )}
                                  
                                  {utilisateurConnecte.role === 'Ingenieur' && (
                                    <>
                                      <button onClick={() => setTicketToTimeline(t)} className="w-8 h-8 flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-lg transition-all shadow-sm group/btn" title="Traçabilité (Audit)"><Activity size={16} className="group-hover/btn:scale-110 transition-transform" /></button>
                                      <button onClick={() => supprimerTicketGlobale(t.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-lg transition-all shadow-sm group/btn" title="Supprimer définitivement"><Trash2 size={14} className="group-hover/btn:scale-110 transition-transform" /></button>
                                    </>
                                  )}

                                  {isAuthorizedToAction && (
                                    <div className="flex gap-1">
                                      {t.statut === 'En attente' && (
                                        <>
                                          <button onClick={() => mettreAJourStatut(t.id, 'En cours')} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-sm font-bold text-xs">Accepter</button>
                                          <button onClick={() => mettreAJourStatut(t.id, 'Refusé')} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all shadow-sm font-bold text-xs">Refuser</button>
                                        </>
                                      )}
                                      {t.statut === 'En cours' && (
                                        <button onClick={() => demanderCloture(t)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm font-bold text-xs flex items-center gap-1"><CheckSquare size={14}/> Clôturer</button>
                                      )}
                                      {(t.statut === 'Clôturé' || t.statut === 'Refusé' || (t.statut || '').includes('Terminé')) && (
                                        <button onClick={() => mettreAJourStatut(t.id, 'En attente')} className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all shadow-sm" title="Annuler et remettre en attente"><Undo2 size={16} /></button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="bg-slate-50/50 dark:bg-[#020617]/50 p-6 min-h-[500px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-4" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'En attente')}>
                    <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-xl"><h3 className="font-bold text-amber-700 dark:text-amber-400">À Faire / Attente</h3><span className="bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-sm">{ticketsFilteredUI.filter(t => (t.statut || '') === 'En attente').length}</span></div>
                    <div className="flex flex-col gap-3 min-h-[150px] p-1 border-2 border-transparent hover:border-amber-200/50 rounded-xl transition-colors"><AnimatePresence>{ticketsFilteredUI.filter(t => (t.statut || '') === 'En attente').map(t => renderKanbanCard(t))}</AnimatePresence></div>
                  </div>
                  <div className="flex flex-col gap-4" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'Bloqué / Problème')}>
                    <div className="flex justify-between items-center bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-xl"><h3 className="font-bold text-red-700 dark:text-red-400">Bloqués / Problème / Refusés</h3><span className="bg-red-200 dark:bg-red-500/20 text-red-800 dark:text-red-300 font-bold px-2 py-0.5 rounded text-sm">{ticketsFilteredUI.filter(t => (t.statut || '') === 'Bloqué / Problème' || t.statut === 'Refusé').length}</span></div>
                    <div className="flex flex-col gap-3 min-h-[150px] p-1 border-2 border-transparent hover:border-red-200/50 rounded-xl transition-colors"><AnimatePresence>{ticketsFilteredUI.filter(t => (t.statut || '') === 'Bloqué / Problème' || t.statut === 'Refusé').map(t => renderKanbanCard(t))}</AnimatePresence></div>
                  </div>
                  <div className="flex flex-col gap-4" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'Terminé')}>
                    <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-xl"><h3 className="font-bold text-emerald-700 dark:text-emerald-400">En Cours / Clôturés</h3><span className="bg-emerald-200 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-sm">{ticketsFilteredUI.filter(t => (t.statut || '').includes('Terminé') || t.statut === 'Clôturé' || t.statut === 'En cours').length}</span></div>
                    <div className="flex flex-col gap-3 min-h-[150px] p-1 border-2 border-transparent hover:border-emerald-200/50 rounded-xl transition-colors"><AnimatePresence>{ticketsFilteredUI.filter(t => (t.statut || '').includes('Terminé') || t.statut === 'Clôturé' || t.statut === 'En cours').map(t => renderKanbanCard(t))}</AnimatePresence></div>
                  </div>
                </div>
              </div>
            )}

            {vueAffichage === 'tableau' && ticketsFilteredUI.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Affichage de <span className="font-bold text-slate-900 dark:text-white">{indexPremierDossier + 1}</span> à <span className="font-bold text-slate-900 dark:text-white">{Math.min(indexDernierDossier, ticketsFilteredUI.length)}</span> sur <span className="font-bold text-slate-900 dark:text-white">{ticketsFilteredUI.length}</span> dossiers</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPageActuelle(prev => Math.max(prev - 1, 1))} disabled={pageActuelle === 1} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={18}/></button>
                  <span className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white shadow-sm transition-colors">Page {pageActuelle} / {totalPages}</span>
                  <button onClick={() => setPageActuelle(prev => Math.min(prev + 1, totalPages))} disabled={pageActuelle === totalPages} className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight size={18}/></button>
                </div>
              </div>
            )}

          </div>
        </motion.div>
      )}

      <div className="mt-8 pb-4 text-center">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
          Premium Engineering Solutions by E.M.S. MechaTech © 2026
        </p>
      </div>
    </div>
  );
}

export default App;