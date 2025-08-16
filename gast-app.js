document.addEventListener('DOMContentLoaded', async function() {
    // De URL en Key worden nu uit supabase_config.js gehaald.
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- Ruimtedefinities ---
    const rooms = [
        { id: 'kamer-a', name: 'Kamer A', type: 'standard', defaultBathroom: 'A' },
        { id: 'kamer-b', name: 'Kamer B', type: 'standard', defaultBathroom: 'B' },
        { id: 'kamer-c', name: 'Kamer C', type: 'optional', defaultBathroom: 'eigen' },
        { id: 'kapel', name: 'De Kapel', type: 'optional', defaultBathroom: null },
    ];

    let allBookings = [];

    // --- Vertalingen ---
    const translations = {
        nl: {
            page_title: "Aanvraach Vrienden op de Fiets - Jabixhûs",
            subtitle: "Aanvraag Vrienden op de Fiets",
            name_label: "Volledige naam",
            email_label: "E-mailadres (verplicht)",
            phone_label: "Telefoonnummer (optioneel)",
            persons_label: "Aantal Personen",
            period_label: "Periode (Aankomst t/m Vertrek)",
            period_placeholder: "Selecteer een periode",
            note_label: "Opmerking (optioneel)",
            note_placeholder: "Bijv. aankomsttijd, vragen...",
            submit_button: "Aanvraag Indienen",
            error_title: "Foutmelding",
            info_title: "Aanvraag Ontvangen",
            info_message_standard: "Bedankt voor uw aanvraag! U ontvangt een bevestiging zodra deze is goedgekeurd.",
            info_message_optional: "De standaardkamers zijn bezet in deze periode. Uw aanvraag is ontvangen en wordt beoordeeld voor een alternatieve kamer. U ontvangt spoedig bericht.",
            error_no_period: "Selecteer alstublieft een periode.",
            error_no_room: "Helaas zijn alle kamers bezet in de geselecteerde periode."
        },
        en: {
            page_title: "Request Friends on Bicycles - Jabixhûs",
            subtitle: "Request Friends on Bicycles",
            name_label: "Full Name",
            email_label: "Email address (required)",
            phone_label: "Phone number (optional)",
            persons_label: "Number of People",
            period_label: "Period (Arrival to Departure)",
            period_placeholder: "Select a period",
            note_label: "Note (optional)",
            note_placeholder: "E.g. arrival time, questions...",
            submit_button: "Submit Request",
            error_title: "Error",
            info_title: "Request Received",
            info_message_standard: "Thank you for your request! You will receive a confirmation once it has been approved.",
            info_message_optional: "The standard rooms are occupied during this period. Your request has been received and will be reviewed for an alternative room. You will be notified shortly.",
            error_no_period: "Please select a period.",
            error_no_room: "Unfortunately, all rooms are occupied during the selected period."
        },
        de: {
            page_title: "Anfrage Vrienden op de Fiets - Jabixhûs",
            subtitle: "Anfrage Vrienden op de Fiets",
            name_label: "Vollständiger Name",
            email_label: "E-Mail-Adresse (erforderlich)",
            phone_label: "Telefonnummer (optional)",
            persons_label: "Anzahl der Personen",
            period_label: "Zeitraum (Ankunft bis Abreise)",
            period_placeholder: "Wählen Sie einen Zeitraum",
            note_label: "Anmerkung (optional)",
            note_placeholder: "Z.B. Ankunftszeit, Fragen...",
            submit_button: "Anfrage Senden",
            error_title: "Fehlermeldung",
            info_title: "Anfrage Erhalten",
            info_message_standard: "Vielen Dank für Ihre Anfrage! Sie erhalten eine Bestätigung, sobald sie genehmigt wurde.",
            info_message_optional: "Die Standardzimmer sind in diesem Zeitraum belegt. Ihre Anfrage wurde erhalten und wird für ein alternatives Zimmer (Die Kapelle) geprüft. Sie werden in Kürze benachrichtigt.",
            error_no_period: "Bitte wählen Sie einen Zeitraum aus.",
            error_no_room: "Leider sind in dem gewählten Zeitraum alle Zimmer belegt."
        },
        fr: {
            page_title: "Demande Vrienden op de Fiets - Jabixhûs",
            subtitle: "Demande Vrienden op de Fiets",
            name_label: "Nom complet",
            email_label: "Adresse e-mail (obligatoire)",
            phone_label: "Numéro de téléphone (optionnel)",
            persons_label: "Nombre de personnes",
            period_label: "Période (Arrivée à Départ)",
            period_placeholder: "Sélectionnez une période",
            note_label: "Remarque (optionnel)",
            note_placeholder: "Par ex. heure d'arrivée, questions...",
            submit_button: "Envoyer la Demande",
            error_title: "Erreur",
            info_title: "Demande Reçue",
            info_message_standard: "Merci pour votre demande ! Vous recevrez une confirmation dès qu'elle sera approuvée.",
            info_message_optional: "Les chambres standard sont occupées pendant cette période. Votre demande a été reçue et sera examinée pour une chambre alternative (La Chapelle). Vous serez averti prochainement.",
            error_no_period: "Veuillez sélectionner une période.",
            error_no_room: "Malheureusement, toutes les chambres sont occupées pendant la période sélectionnée."
        },
        es: {
            page_title: "Solicitud Vrienden op de Fiets - Jabixhûs",
            subtitle: "Solicitud Vrienden op de Fiets",
            name_label: "Nombre completo",
            email_label: "Dirección de correo electrónico (obligatorio)",
            phone_label: "Número de teléfono (opcional)",
            persons_label: "Número de personas",
            period_label: "Período (Llegada a Salida)",
            period_placeholder: "Seleccione un período",
            note_label: "Nota (opcional)",
            note_placeholder: "Por ej. hora de llegada, preguntas...",
            submit_button: "Enviar Solicitud",
            error_title: "Error",
            info_title: "Solicitud Recibida",
            info_message_standard: "¡Gracias por su solicitud! Recibirá una confirmación tan pronto como sea aprobada.",
            info_message_optional: "Las habitaciones estándar están ocupadas durante este período. Su solicitud ha sido recibida y será revisada para una habitación alternativa (La Capilla). Se le notificará en breve.",
            error_no_period: "Por favor, seleccione un período.",
            error_no_room: "Lamentablemente, todas las habitaciones están ocupadas durante el período seleccionado."
        },
        fy: {
            page_title: "Oanfraach Freonen op de Fyts - Jabixhûs",
            subtitle: "Oanfraach Freonen op de Fyts",
            name_label: "Folsleine namme",
            email_label: "E-mailadres (ferplichte)",
            phone_label: "Tillefoannûmer (opsjoneel)",
            persons_label: "Oantal persoanen",
            period_label: "Perioade (Oankomst oant Fertrek)",
            period_placeholder: "Selektearje in perioade",
            note_label: "Opmerking (opsjoneel)",
            note_placeholder: "Byg. oankomsttiid, fragen...",
            submit_button: "Oanfraach Yntsjinje",
            error_title: "Flater",
            info_title: "Oanfraach Untfongen",
            info_message_standard: "Tank foar jo oanfraach! Jo ûntfange in befêstiging sa gau't dizze goedkard is.",
            info_message_optional: "De standertkeamers binne beset yn dizze perioade. Jo oanfraach is ûntfongen en wurdt beoardiele foar in alternative keamer. Jo krije meikoarten berjocht.",
            error_no_period: "Selektearje asjebleaft in perioade.",
            error_no_room: "Spitigernôch binne alle keamers beset yn de selektearre perioade."
        }
    };
    let currentLanguage = 'nl';

    const errorModal = document.getElementById('error-modal');
    const infoModal = document.getElementById('info-modal');
    const errorMessageEl = document.getElementById('error-message');
    const infoMessageEl = document.getElementById('info-message');
    let requestDateRange = { start: null, end: null };
    let requestPicker = null;

    function convertDateToNumber(dateStr) {
        return parseInt(dateStr.replace(/-/g, ''));
    }

    function isRoomOccupiedOnDate(roomId, dateStr, bookingList) {
        const checkDateNum = convertDateToNumber(dateStr);
        return bookingList.some(booking => {
            if (booking.kamer !== roomId || !booking.start_datum || !booking.eind_datum) return false;
            const startDateNum = convertDateToNumber(booking.start_datum);
            const endDateNum = convertDateToNumber(booking.eind_datum);
            return checkDateNum >= startDateNum && checkDateNum < endDateNum;
        });
    }

    function checkOverlap(eventToCheck, eventList) {
        if (!eventToCheck.startDate || !eventToCheck.endDate || !eventToCheck.roomId) return false;
        const checkStartNum = convertDateToNumber(eventToCheck.startDate);
        const checkEndNum = convertDateToNumber(eventToCheck.endDate);
        return eventList.some(event => {
            if (!event.kamer || !event.start_datum || !event.eind_datum) return false;
            if (event.kamer !== eventToCheck.roomId) return false;
            const eventStartNum = convertDateToNumber(event.start_datum);
            const eventEndNum = convertDateToNumber(event.eind_datum);
            return checkStartNum < eventEndNum && checkEndNum > eventStartNum;
        });
    }

    function closeErrorModal() { errorModal.style.display = 'none'; }
    function closeInfoModal() { infoModal.style.display = 'none'; }

    function showErrorModal(translationKey) {
        errorMessageEl.textContent = translations[currentLanguage][translationKey] || translationKey;
        errorModal.style.display = 'flex';
    }

    function showInfoModal(translationKey) {
        infoMessageEl.textContent = translations[currentLanguage][translationKey] || translationKey;
        infoModal.style.display = 'flex';
    }

    function setLanguage(lang, bookingsData) {
        currentLanguage = lang;
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.dataset.translate;
            if (translations[lang] && translations[lang][key]) {
                el.textContent = translations[lang][key];
            }
        });
        document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
            const key = el.dataset.translatePlaceholder;
            if (translations[lang] && translations[lang][key]) {
                el.placeholder = translations[lang][key];
            }
        });
        if (translations[lang] && translations[lang].page_title) {
            document.title = translations[lang].page_title;
        }
        initializeRequestPicker(bookingsData);
    }

    function initializeRequestPicker(bookingsData) {
        if (requestPicker) requestPicker.destroy();
        const lockedDays = [];
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const lastDayUTC = new Date(Date.UTC(todayUTC.getUTCFullYear() + 1, todayUTC.getUTCMonth(), todayUTC.getUTCDate()));
        const oneDayInMs = 86400000;

        for (let ts = todayUTC.getTime(); ts <= lastDayUTC.getTime(); ts += oneDayInMs) {
            const currentDay = new Date(ts);
            const dateStr = currentDay.toISOString().slice(0, 10);
            const isDayFull = rooms.every(room => isRoomOccupiedOnDate(room.id, dateStr, bookingsData));
            if (isDayFull) {
                lockedDays.push(currentDay);
            }
        }

        requestPicker = new Litepicker({
            element: document.getElementById('date-range-request'),
            singleMode: false,
            autoApply: true,
            lang: currentLanguage,
            format: 'DD-MM-YYYY',
            lockDays: lockedDays,
            minDate: new Date(),
            setup: (picker) => {
                picker.on('selected', (date1, date2) => {
                    requestDateRange.start = date1.format('YYYY-MM-DD');
                    requestDateRange.end = date2.format('YYYY-MM-DD');
                });
            },
        });
    }

    document.getElementById('request-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        if (!requestDateRange.start || !requestDateRange.end) {
            showErrorModal('error_no_period');
            return;
        }

        const standardRooms = rooms.filter(r => r.type === 'standard');
        const optionalRooms = rooms.filter(r => r.type === 'optional');
        let assignedRoom = null;
        let isOptional = false;

        const allStandardRoomsOccupied = standardRooms.every(room => {
            return checkOverlap({ startDate: requestDateRange.start, endDate: requestDateRange.end, roomId: room.id }, allBookings);
        });

        if (allStandardRoomsOccupied) {
            for (const room of optionalRooms) {
                if (!checkOverlap({ startDate: requestDateRange.start, endDate: requestDateRange.end, roomId: room.id }, allBookings)) {
                    assignedRoom = room;
                    isOptional = true;
                    break;
                }
            }
        } else {
            for (const room of standardRooms) {
                if (!checkOverlap({ startDate: requestDateRange.start, endDate: requestDateRange.end, roomId: room.id }, allBookings)) {
                    assignedRoom = room;
                    break;
                }
            }
        }

        if (!assignedRoom) {
            showErrorModal('error_no_room');
            return;
        }

        // NIEUWE GECORRIGEERDE CODE
const name = form.name.value;
const email = form.email.value;
const phone = form.phone.value;
const note = form['note-request'].value;
// De notities bevatten nu de contactgegevens en opmerking
const combinedNotes = `E-mail: ${email} | Tel: ${phone || 'n.v.t.'} | Opmerking: ${note || 'geen'}`;

const { error } = await supabaseClient.from('reserveringen').insert([{
    gast_naam: name, // De naam van de gast komt nu in het juiste veld
    start_datum: requestDateRange.start,
    eind_datum: requestDateRange.end,
    kamer: assignedRoom.id,
    badkamer: assignedRoom.defaultBathroom === 'eigen' ? null : assignedRoom.defaultBathroom,
    aantal_personen: parseInt(form['persons-request'].value),
    notities: combinedNotes, // De notities bevatten nu de rest van de info
    bron: 'vrienden',
    status: 'aangevraagd'
}]);

        if (error) {
            console.error("Fout bij opslaan aanvraag:", error);
            showErrorModal('Fout bij het indienen. Probeer het opnieuw.');
            return;
        }

        form.reset();
        requestPicker.clearSelection();
        requestDateRange = { start: null, end: null };
        showInfoModal(isOptional ? 'info_message_optional' : 'info_message_standard');
    });

    document.getElementById('language-selector').addEventListener('change', (e) => setLanguage(e.target.value, allBookings));
    document.getElementById('close-error-modal').addEventListener('click', closeErrorModal);
    document.getElementById('close-info-modal').addEventListener('click', closeInfoModal);
    window.addEventListener('click', (e) => {
        if (e.target === errorModal) closeErrorModal();
        if (e.target === infoModal) closeInfoModal();
    });

    async function initializeApp() {
        // --- DEZE REGEL IS AANGEPAST ---
        const { data, error } = await supabaseClient
            .from('reserveringen')
            .select('id, kamer, start_datum, eind_datum')
            .eq('status', 'bevestigd'); // Alleen 'bevestigde' boekingen ophalen

        if (error) {
            console.error("Fout bij ophalen boekingen:", error);
            showErrorModal("Kan de beschikbaarheid niet laden.");
            return;
        }
        allBookings = data || [];
        setLanguage('nl', allBookings);
    }

    initializeApp();
});