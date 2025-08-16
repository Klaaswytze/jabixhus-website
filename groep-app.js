// groep-app.js - Definitieve versie 2.0 (correcte data-opschoning)

document.addEventListener('DOMContentLoaded', async () => {
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const bookableSpaces = [
        { id: 'kamer-a', name: 'Slaapkamer A (2 persoons)', description: 'Een sfeervolle, rustige kamer met een comfortabel tweepersoonsbed (160x200cm). Deze kamer beschikt over een eigen, moderne badkamer.' },
        { id: 'kamer-b', name: 'Slaapkamer B (2 persoons)', description: 'Een gezellige, lichte kamer met een tweepersoonsbed (140x200cm). Ook deze kamer heeft een eigen, moderne badkamer.' },
        { id: 'kapel', name: 'De Kapel (Creatieve Gebedsruimte)', description: 'Onze meest unieke ruimte. Perfect voor bezinning, meditatie, muziek maken of als inspirerende vergaderplek. Kan in overleg ook als extra slaapruimte worden ingericht.' },
        { id: 'workshop', name: 'Workshopruimte', description: 'Een praktische en lichte ruimte, ideaal voor het geven of volgen van cursussen, presentaties of creatieve workshops. Grenst aan de horecakeuken.' },
        { id: 'woonkeuken', name: 'Woonkeuken & Leefruimte', description: 'Het sociale hart van het gastenverblijf. Een compleet ingerichte, sfeervolle keuken voor dagelijks gebruik door gasten van de slaapkamers.' },
        { id: 'horecakeuken', name: 'Horecakeuken (Professioneel)', description: 'Een aparte, professioneel uitgeruste keuken voor grote groepen, workshops of evenementen.' },
        { id: 'tuin', name: 'Tuin met Vuurplaats', description: 'Een rustige, afgelegen stadstuin om te ontspannen. Voorzien van een vuurplaats en een klein podium, ideaal voor intieme bijeenkomsten.' }
    ];
    
    const primarySpacesForFullCheck = ['kamer-a', 'kamer-b', 'kapel', 'workshop', 'tuin', 'horecakeuken'];
    let confirmedBookings = [];
    let picker = null;

    async function fetchConfirmedBookings() {
        const { data, error } = await supabaseClient
            .from('reserveringen')
            .select('kamer, start_datum, eind_datum')
            .eq('status', 'bevestigd');
        if (error) {
            console.error('Fout bij ophalen boekingen:', error);
            return [];
        }
        return data;
    }

    const dateToNum = (dateStr) => parseInt(dateStr.replace(/-/g, ''));

    function isSpaceBookedInPeriod(spaceId, startDateStr, endDateStr) {
        const startNum = dateToNum(startDateStr);
        const endNum = dateToNum(endDateStr);
        for (const booking of confirmedBookings) {
            if (booking.kamer === spaceId && booking.start_datum && booking.eind_datum) {
                const bookingStartNum = dateToNum(booking.start_datum);
                const bookingEndNum = dateToNum(booking.eind_datum);
                if (startNum < bookingEndNum && endNum >= bookingStartNum) {
                    return true;
                }
            }
        }
        return false;
    }
    
    function renderSpaces(startDate, endDate) {
        const container = document.getElementById('space-selection-container');
        container.innerHTML = ''; 
        bookableSpaces.forEach(space => {
            const isBooked = isSpaceBookedInPeriod(space.id, startDate, endDate);
            const card = document.createElement('div');
            card.className = `space-card ${isBooked ? 'disabled' : 'cursor-pointer'}`;
            card.innerHTML = `
                <div class="flex items-start">
                    <input id="check-${space.id}" name="spaces" type="checkbox" value="${space.id}" class="h-5 w-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 mt-1" ${isBooked ? 'disabled' : ''}>
                    <label for="check-${space.id}" class="ml-3">
                        <span class="block text-md font-semibold text-gray-800">${space.name}</span>
                        <span class="block text-sm text-gray-600 mt-1">${space.description}</span>
                    </label>
                </div>`;
            container.appendChild(card);
        });
        
        document.querySelectorAll('.space-card:not(.disabled)').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                card.classList.toggle('checked', checkbox.checked);
            });
        });
    }

    function initializePicker() {
        const dayOccupancy = new Map();
        confirmedBookings.forEach(booking => {
            if (!booking.start_datum || !booking.eind_datum) {
                console.warn('Boeking overgeslagen wegens incomplete data:', booking);
                return;
            }
            let currentDate = new Date(booking.start_datum + 'T00:00:00Z');
            const endDate = new Date(booking.eind_datum + 'T00:00:00Z');
            while (currentDate < endDate) {
                const dateStr = currentDate.toISOString().slice(0, 10);
                if (!dayOccupancy.has(dateStr)) dayOccupancy.set(dateStr, new Set());
                dayOccupancy.get(dateStr).add(booking.kamer);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });

        const partialDays = [], fullDays = [];
        dayOccupancy.forEach((bookedRooms, dateStr) => {
            let primaryBookedCount = 0;
            primarySpacesForFullCheck.forEach(spaceId => {
                if (bookedRooms.has(spaceId)) primaryBookedCount++;
            });
            if (primaryBookedCount >= primarySpacesForFullCheck.length) fullDays.push(dateStr);
            else partialDays.push(dateStr);
        });

        picker = new Litepicker({
            element: document.getElementById('date-range-groep'),
            singleMode: false, autoApply: true, minDate: new Date(), lang: 'nl-NL',
            format: 'DD-MM-YYYY', lockDays: fullDays, highlightedDays: partialDays,
        });
        picker.on('selected', (date1, date2) => {
            if (date1 && date2) renderSpaces(date1.format('YYYY-MM-DD'), date2.format('YYYY-MM-DD'));
        });
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        if (!picker.getStartDate() || !picker.getEndDate()) { alert('Selecteer alstublieft een periode.'); return; }
        const selectedSpaces = Array.from(form.querySelectorAll('input[name="spaces"]:checked')).map(cb => cb.value);
        if (selectedSpaces.length === 0) { alert('Selecteer alstublieft ten minste één ruimte.'); return; }

        const startDate = picker.getStartDate().format('YYYY-MM-DD');
        const endDate = picker.getEndDate().format('YYYY-MM-DD');
        const contactName = form.querySelector('#contact-name').value;
        const groupName = form.querySelector('#group-name').value;
        const email = form.querySelector('#email').value;
        const phone = form.querySelector('#phone').value;
        const personCount = form.querySelector('#person-count').value;
        let purpose = form.querySelector('#stay-purpose').value;
        const purposeOther = form.querySelector('#purpose-other').value;
        const wishes = form.querySelector('#extra-wishes').value;

        if (purpose === 'Anders' && purposeOther) purpose = purposeOther;
        
        // *** HIER IS DE DEFINITIEVE CORRECTIE VOOR DE GROEPSNOTITIE ***
        const noteContent = `Contactgegevens: ${email}, ${phone}. Aantal: ${personCount} pers. Doel: ${purpose}. Wensen: ${wishes || 'Geen'}`.trim().replace(/\s+/g, ' ');

        const newGroupId = crypto.randomUUID();
        const newBookingRequests = selectedSpaces.map(spaceId => ({
            start_datum: startDate, eind_datum: endDate, gast_naam: groupName || contactName,
            kamer: spaceId, bron: 'group-request', status: 'aangevraagd',
            aantal_personen: personCount, groep_id: newGroupId, groepsnotitie: noteContent,
        }));
        
        const { error } = await supabaseClient.from('reserveringen').insert(newBookingRequests);
        if (error) {
            document.getElementById('error-message').textContent = `Er is een fout opgetreden: ${error.message}`;
            document.getElementById('error-modal').style.display = 'flex';
        } else {
            document.getElementById('info-modal').style.display = 'flex';
            form.reset();
            picker.clearSelection();
            document.getElementById('space-selection-container').innerHTML = '<p class="text-sm text-gray-500">Kies eerst een periode om de beschikbaarheid van de ruimtes te zien.</p>';
            document.getElementById('purpose-other-container').classList.add('hidden');
        }
    }

    async function initializeApp() {
        confirmedBookings = await fetchConfirmedBookings();
        initializePicker();
        document.getElementById('groep-request-form').addEventListener('submit', handleFormSubmit);
        document.getElementById('close-error-modal').addEventListener('click', () => document.getElementById('error-modal').style.display = 'none');
        document.getElementById('close-info-modal').addEventListener('click', () => document.getElementById('info-modal').style.display = 'none');
        const purposeSelect = document.getElementById('stay-purpose');
        const purposeOtherContainer = document.getElementById('purpose-other-container');
        purposeSelect.addEventListener('change', () => {
            if (purposeSelect.value === 'Anders') purposeOtherContainer.classList.remove('hidden');
            else purposeOtherContainer.classList.add('hidden');
        });
    }
    
    initializeApp();
});