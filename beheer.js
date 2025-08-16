// De URL en Key worden nu uit supabase_config.js gehaald.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLoginStatus() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) { window.location.href = 'login.html'; }
    else { console.log('Gebruiker is ingelogd:', session.user.email); }
}
checkLoginStatus();

document.addEventListener('DOMContentLoaded', async function() {
    // --- DATA ---
    const rooms = [
        { id: 'kamer-a', name: 'Kamer A', category: 'slaapkamer', defaultBathroom: 'A' },
        { id: 'kamer-b', name: 'Kamer B', category: 'slaapkamer', defaultBathroom: 'B' },
        { id: 'kamer-c', name: 'Kamer C', category: 'slaapkamer', defaultBathroom: 'eigen' },
        { id: 'kapel', name: 'De Kapel', category: 'multifunctioneel', defaultBathroom: null },
        { id: 'workshop', name: 'Workshopruimte', category: 'evenement' },
        { id: 'horecakeuken', name: 'Horecakeuken', category: 'evenement' },
        { id: 'tuin', name: 'Tuin', category: 'evenement' }
    ];
    const bookingColors = { airbnb: '#f97316', vrienden: '#2563eb', blocked: '#475569', group: '#10b981', request: '#a5b4fc', note: '#fef08a', event: '#8b5cf6' };
    const eventColorPalette = [ '#4a7c59', '#8f5d5d', '#5a7d9a', '#8c6d3a', '#a88d6c', '#595758', '#7c4a69' ];

    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth();
    let selectedDateStr = new Date().toISOString().slice(0, 10);
    
    let isDragging = false, dragJustEnded = false, selectionStartDate = null, selectionEndDate = null;
    let groupDateRange = { start: null, end: null }, eventDateRange = { start: null, end: null };
    let groupPicker = null, eventPicker = null;

    let formattedEvents = [], bookings = [], requests = [];

    // --- ELEMENT CACHE ---
    const calendarBody = document.getElementById('calendar-body');
    const monthYearEl = document.getElementById('month-year');
    const floorplanDatePicker = document.getElementById('floorplan-date-picker');
    const floorplanContainer = document.getElementById('floorplan-container');
    const requestsList = document.getElementById('requests-list');
    
    const contextMenu = document.createElement('div');
    contextMenu.id = 'context-menu';
    document.body.appendChild(contextMenu);

    const quickBookingModal = document.getElementById('quick-booking-modal');
    const groupBookingModal = document.getElementById('group-booking-modal');
    const eventBookingModal = document.getElementById('event-booking-modal');
    const dayModal = document.getElementById('day-modal');
    const bookingModal = document.getElementById('booking-modal');
    const deleteChoiceModal = document.getElementById('delete-choice-modal');
    const deleteSingleBtn = document.getElementById('delete-single-confirm-btn');
    const deleteGroupBtn = document.getElementById('delete-group-confirm-btn');
    const deleteChoiceRoomName = document.getElementById('delete-choice-room-name');
    const deleteChoiceGroupName = document.getElementById('delete-choice-group-name');
    const swapConfirmModal = document.getElementById('swap-confirm-modal');
    const swapConfirmBtn = document.getElementById('swap-confirm-btn');
    const swapConfirmTitle = document.getElementById('swap-confirm-title');
    const swapConfirmText = document.getElementById('swap-confirm-text');
    const moveConfirmModal = document.getElementById('move-confirm-modal');
    const moveConfirmBtn = document.getElementById('move-confirm-btn');
    const moveConfirmTitle = document.getElementById('move-confirm-title');
    const moveConfirmText = document.getElementById('move-confirm-text');
    
    function isDateInRange(checkDateStr, startDateStr, endDateStr) {
        if (!startDateStr || !endDateStr) return false;
        const checkDate = new Date(checkDateStr + 'T00:00:00Z');
        const startDate = new Date(startDateStr + 'T00:00:00Z');
        const endDate = new Date(endDateStr + 'T00:00:00Z');
        return checkDate >= startDate && checkDate < endDate;
    }

    function populateFormElements() {
        const groupRoomsCheckboxes = document.getElementById('group-rooms-checkboxes');
        if (groupRoomsCheckboxes) {
            groupRoomsCheckboxes.innerHTML = '';
            rooms.forEach(room => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'flex items-center';
                checkboxDiv.innerHTML = `<input id="room-check-${room.id}" name="group-rooms" type="checkbox" value="${room.id}" class="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"><label for="room-check-${room.id}" class="ml-3 block text-sm text-gray-900">${room.name}</label>`;
                groupRoomsCheckboxes.appendChild(checkboxDiv);
            });
        }

        const eventSpacesCheckboxes = document.getElementById('event-spaces-checkboxes');
        if (eventSpacesCheckboxes) {
            eventSpacesCheckboxes.innerHTML = '';
            rooms.filter(r => r.category === 'evenement' || r.category === 'multifunctioneel').forEach(room => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'flex items-center';
                checkboxDiv.innerHTML = `<input id="event-check-${room.id}" name="event-spaces" type="checkbox" value="${room.id}" class="h-4 w-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"><label for="event-check-${room.id}" class="ml-3 block text-sm text-gray-900">${room.name}</label>`;
                eventSpacesCheckboxes.appendChild(checkboxDiv);
            });
        }
    }

    function getColorForGroupId(groupId) {
        if (!groupId) return '#6b7280';
        let hash = 0;
        for (let i = 0; i < groupId.length; i++) {
            hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash % eventColorPalette.length);
        return eventColorPalette[index];
    }
    async function fetchBookings() {
        const { data, error } = await supabaseClient.from('reserveringen').select('*');
        if (error) { console.error("Fout bij ophalen boekingen:", error); return []; }
        return data;
    }
    async function refreshDataAndRender() {
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        const allDataFromDB = await fetchBookings();
        formattedEvents = (allDataFromDB || [])
            .filter(dbRow => dbRow && dbRow.start_datum && dbRow.eind_datum)
            .map(dbRow => ({
                id: dbRow.id,
                startDate: dbRow.start_datum,
                endDate: dbRow.eind_datum,
                roomId: dbRow.kamer,
                type: dbRow.bron,
                name: dbRow.gast_naam,
                note: dbRow.notities,
                status: dbRow.status,
                persons: dbRow.aantal_personen,
                bathroom: dbRow.badkamer,
                groepId: dbRow.groep_id,
                groepsnotitie: dbRow.groepsnotitie
            }));
        bookings = formattedEvents.filter(event => event.status === 'bevestigd');
        requests = formattedEvents.filter(event => event.status === 'aangevraagd');
        renderAll();
    }
    function getRoomName(roomId) { return rooms.find(r => r.id === roomId)?.name || ''; }
    function formatDate(date, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
        if (typeof date === 'string') date = new Date(date + 'T00:00:00Z');
        return date.toLocaleDateString('nl-NL', { ...options, timeZone: 'UTC' });
    }
    function renderAll() {
        renderCalendar();
        renderFloorplan(selectedDateStr);
        renderRequests();
    }
    function checkOverlap(eventToCheck, eventList) {
        if (!eventToCheck.startDate || !eventToCheck.endDate) return false;
        const otherEvents = eventList.filter(event => !(event.id && event.id === eventToCheck.id));
        
        return otherEvents.some(event => {
            const checkStart = new Date(eventToCheck.startDate);
            const checkEnd = new Date(eventToCheck.endDate);
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);
            
            const rangesOverlap = checkStart < eventEnd && checkEnd > eventStart;
            if (!rangesOverlap) return false;

            const roomOverlap = eventToCheck.roomId && event.roomId === eventToCheck.roomId;
            const bathroomOverlap = eventToCheck.bathroom && event.bathroom === eventToCheck.bathroom;

            return roomOverlap || bathroomOverlap;
        });
    }
    function handleDragStart(e) {
        if (e.target.closest('.booking')) return;
        const handle = e.target;
        if (!handle.classList.contains('day-drag-handle')) return;
        hideContextMenu();
        isDragging = true;
        selectionStartDate = handle.closest('.calendar-day').dataset.date;
        selectionEndDate = selectionStartDate;
        document.body.style.userSelect = 'none';
        updateSelectionHighlight();
    }
    function handleDragOver(e) {
        if (!isDragging) return;
        const dayCell = e.target.closest('.calendar-day');
        if (dayCell && dayCell.dataset.date) {
            selectionEndDate = dayCell.dataset.date;
            updateSelectionHighlight();
        }
    }
    function handleDragEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        dragJustEnded = true; 
        document.body.style.userSelect = 'auto';
        let finalStartDate = new Date(selectionStartDate);
        let finalEndDate = new Date(selectionEndDate);
        if (finalEndDate < finalStartDate) [finalStartDate, finalEndDate] = [finalEndDate, finalStartDate];
        finalEndDate.setDate(finalEndDate.getDate() + 1);
        showContextMenu(e.clientX, e.clientY, finalStartDate, finalEndDate);
        setTimeout(() => { dragJustEnded = false; }, 100);
    }
    function updateSelectionHighlight() {
        document.querySelectorAll('.calendar-day.day-in-selection').forEach(d => d.classList.remove('day-in-selection'));
        if (!selectionStartDate || !selectionEndDate) return;
        const start = new Date(selectionStartDate);
        const end = new Date(selectionEndDate);
        const loopStart = start < end ? start : end;
        const loopEnd = start < end ? end : start;
        for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().slice(0, 10);
            const dayCell = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
            if (dayCell) dayCell.classList.add('day-in-selection');
        }
    }
    function showContextMenu(x, y, startDate, endDate) {
        contextMenu.style.display = 'block';
        const rect = contextMenu.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        let left = x, top = y;
        if (x + rect.width > bodyRect.width) left = x - rect.width;
        if (y + rect.height > bodyRect.height) top = y - rect.height;
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
        const isSingleDay = (endDate.getTime() - startDate.getTime()) <= (24 * 60 * 60 * 1000);
        const periodText = isSingleDay ? `voor ${formatDate(startDate, { day: 'numeric', month: 'long' })}` : `van ${formatDate(startDate, { day: 'numeric', month: 'long' })} t/m ${formatDate(new Date(endDate - 24*60*60*1000), { day: 'numeric', month: 'long' })}`;
        contextMenu.innerHTML = `<div class="menu-title">${periodText}</div><a href="#" data-action="new-booking">Nieuwe Boeking (kamer)</a><a href="#" data-action="new-group-booking">Nieuwe Groepsboeking</a><a href="#" data-action="new-event">Nieuw Evenement</a><div class="menu-divider"></div><a href="#" data-action="block-period">Periode Blokkeren</a><a href="#" data-action="new-note">Notitie Toevoegen</a>`;
        contextMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
            e.preventDefault();
            handleMenuAction(a.dataset.action, startDate, endDate);
        }));
    }
    function showKapelContextMenu(x, y, startDate, endDate) {
        contextMenu.style.display = 'block';
        const rect = contextMenu.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        let left = x, top = y;
        if (x + rect.width > bodyRect.width) left = x - rect.width;
        if (y + rect.height > bodyRect.height) top = y - rect.height;
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
        contextMenu.innerHTML = `
            <div class="menu-title">Actie voor De Kapel</div>
            <a href="#" id="menu-kapel-overnachting">Boek als Overnachting</a>
            <a href="#" id="menu-kapel-evenement">Boek als Evenement</a>`;
        document.getElementById('menu-kapel-overnachting').addEventListener('click', (e) => {
            e.preventDefault();
            hideContextMenu();
            const startStr = startDate.toISOString().slice(0, 10);
            const endStr = endDate.toISOString().slice(0, 10);
            openQuickBookingModal(startStr, endStr, 'kapel', 'vrienden');
        });
        document.getElementById('menu-kapel-evenement').addEventListener('click', (e) => {
            e.preventDefault();
            hideContextMenu();
            handleMenuAction('new-event', startDate, endDate, 'kapel');
        });
    }
    function hideContextMenu() {
        contextMenu.style.display = 'none';
        document.querySelectorAll('.calendar-day.day-in-selection').forEach(d => d.classList.remove('day-in-selection'));
    }
    function handleMenuAction(action, startDate, endDate, preselectRoomId = null) {
        hideContextMenu();
        const startStr = startDate.toISOString().slice(0,10);
        const endStr = endDate.toISOString().slice(0,10);
        switch (action) {
            case 'new-booking': 
                openQuickBookingModal(startStr, endStr, null, 'vrienden'); 
                break;
            case 'block-period': 
                openQuickBookingModal(startStr, endStr, null, 'blocked'); 
                break;
            case 'new-note': 
                openDayModal(startStr); 
                break;
            case 'new-group-booking': 
                document.getElementById('group-booking-form').reset();
                groupBookingModal.style.display = 'flex';
                if (!groupPicker) {
                    groupPicker = new Litepicker({ element: document.getElementById('date-range-group'), singleMode: false, autoApply: true, lang: 'nl-NL', format: 'DD-MM-YYYY', setup: (picker) => { picker.on('selected', (date1, date2) => { if (date1 && date2) { 
                            groupDateRange.start = date1.format('YYYY-MM-DD'); 
                            let d2 = new Date(date2.toJSDate()); d2.setDate(d2.getDate() + 1); 
                            groupDateRange.end = d2.toISOString().slice(0, 10);
                            updateGroupRoomAvailability(groupDateRange.start, groupDateRange.end);
                        } }); } });
                }
                groupPicker.setDateRange(startDate, new Date(endDate - 24*60*60*1000));
                updateGroupRoomAvailability(startStr, endStr);
                break;
            case 'new-event': 
                document.getElementById('event-booking-form').reset();
                eventBookingModal.style.display = 'flex';
                if (!eventPicker) {
                    eventPicker = new Litepicker({ element: document.getElementById('date-range-event'), singleMode: false, autoApply: true, lang: 'nl-NL', format: 'DD-MM-YYYY', setup: (picker) => { picker.on('selected', (date1, date2) => { if (date1 && date2) { 
                            eventDateRange.start = date1.format('YYYY-MM-DD'); 
                            let d2 = new Date(date2.toJSDate()); d2.setDate(d2.getDate() + 1); 
                            eventDateRange.end = d2.toISOString().slice(0, 10);
                            updateEventSpaceAvailability(eventDateRange.start, eventDateRange.end);
                        } }); } });
                }
                eventPicker.setDateRange(startDate, new Date(endDate - 24*60*60*1000));
                updateEventSpaceAvailability(startStr, endStr);
                
                if (preselectRoomId) {
                    const checkbox = document.getElementById(`event-check-${preselectRoomId}`);
                    if (checkbox && !checkbox.disabled) checkbox.checked = true;
                }
                break;
        }
    }
    function renderCalendar() {
        calendarBody.innerHTML = '';
        const date = new Date(currentYear, currentMonth, 1);
        monthYearEl.textContent = date.toLocaleString('nl-NL', { month: 'long', year: 'numeric' });
        const firstDayOfMonth = (date.getDay() + 6) % 7;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let i = 0; i < firstDayOfMonth; i++) { calendarBody.innerHTML += '<div class="calendar-day bg-gray-50 !cursor-default"></div>'; }
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = document.createElement('div');
            const fullDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayEl.className = `calendar-day ${fullDate === selectedDateStr ? 'border-2 border-blue-500' : ''}`;
            dayEl.dataset.date = fullDate;
            dayEl.innerHTML = `<div class="day-drag-handle"></div><span class="text-sm font-medium text-gray-600 ml-1 relative z-10">${day}</span><div class="booking-wrapper relative z-10"></div>`;
            dayEl.addEventListener('click', () => {
                if(dragJustEnded) return;
                selectedDateStr = fullDate;
                renderAll();
            });
            calendarBody.appendChild(dayEl);
        }
        formattedEvents.forEach(event => {
            for (let d = new Date(event.startDate); d < new Date(event.endDate); d.setDate(d.getDate() + 1)) {
                if (d.getUTCFullYear() !== currentYear || d.getUTCMonth() !== currentMonth) continue;
                const dateString = d.toISOString().split('T')[0];
                const dayCell = calendarBody.querySelector(`.calendar-day[data-date="${dateString}"]`);
                if (dayCell) {
                    const wrapper = dayCell.querySelector('.booking-wrapper');
                    const bookingEl = document.createElement('div');
                    bookingEl.textContent = event.name;
                    bookingEl.dataset.bookingId = event.id;
                    const typeLabel = event.type.charAt(0).toUpperCase() + event.type.slice(1);
                    bookingEl.title = `${typeLabel}: ${event.name}`;

                    // *** HIER IS DE BUXFIX TOEGEPAST ***
                    if (event.groepId && (event.type === 'group' || event.type === 'event' || event.type === 'blocked' || event.type === 'group-request')) {
                        bookingEl.className = 'booking';
                        bookingEl.style.backgroundColor = getColorForGroupId(event.groepId);
                    } else if (event.status === 'aangevraagd') {
                        bookingEl.className = 'booking booking-request';
                    } else {
                        bookingEl.className = `booking booking-${event.type}`;
                    }

                    bookingEl.addEventListener('click', (e) => { e.stopPropagation(); openBookingModal(event); });
                    wrapper.appendChild(bookingEl);
                }
            }
        });
        calendarBody.addEventListener('mousedown', handleDragStart);
        calendarBody.addEventListener('mouseover', handleDragOver);
        document.addEventListener('mouseup', handleDragEnd);
    }
    function renderFloorplan(dateStr) {
        floorplanDatePicker.value = dateStr;
        const allEvents = [...bookings, ...requests];
        rooms.forEach(room => {
            const roomEl = document.getElementById(`fp-${room.id}`);
            if (!roomEl) return;
            const eventOnDayForRoom = allEvents.find(e => e.roomId === room.id && isDateInRange(dateStr, e.startDate, e.endDate));
            
            roomEl.className = 'floorplan-space floorplan-room';
            delete roomEl.dataset.bookingId;
            delete roomEl.dataset.dragType;
            roomEl.style.backgroundColor = '';
            roomEl.style.color = '';
            
            if (eventOnDayForRoom) {
                const typeLabel = eventOnDayForRoom.type.charAt(0).toUpperCase() + eventOnDayForRoom.type.slice(1);
                roomEl.title = `${typeLabel}: ${eventOnDayForRoom.name}`;
                if ((eventOnDayForRoom.type === 'group' || eventOnDayForRoom.type === 'event' || eventOnDayForRoom.type === 'blocked' || eventOnDayForRoom.type === 'group-request') && eventOnDayForRoom.groepId) {
                    roomEl.style.backgroundColor = getColorForGroupId(eventOnDayForRoom.groepId);
                    roomEl.style.color = 'white';
                } else if (eventOnDayForRoom.status === 'aangevraagd') {
                    roomEl.classList.add(`booking-request`);
                } else {
                    roomEl.classList.add(`booking-${eventOnDayForRoom.type}`);
                }
                roomEl.innerHTML = `<div class="font-bold">${room.name}</div><div class="text-sm mt-1">${eventOnDayForRoom.name}</div>`;
                roomEl.draggable = true;
                roomEl.dataset.bookingId = eventOnDayForRoom.id;
                roomEl.dataset.dragType = 'guest';
            } else {
                roomEl.title = '';
                roomEl.classList.add('room-free');
                roomEl.innerHTML = `<div class="font-bold">${room.name}</div><div class="text-sm mt-1">Vrij</div>`;
                roomEl.draggable = false;
            }
        });

        const bathA = document.getElementById('bath-a-container');
        const bathB = document.getElementById('bath-b-container');
        const bookingForBathA = allEvents.find(e => e.bathroom === 'A' && isDateInRange(dateStr, e.startDate, e.endDate));
        const bookingForBathB = allEvents.find(e => e.bathroom === 'B' && isDateInRange(dateStr, e.startDate, e.endDate));
        
        [bathA, bathB].forEach(b => { 
            b.className = 'bath-sub-item non-bookable'; 
            b.style.backgroundColor = ''; 
            b.classList.remove('text-white'); 
            b.draggable = false;
            b.title = '';
            delete b.dataset.bookingId;
            delete b.dataset.dragType;
        });

        if (bookingForBathA) {
            const typeLabel = bookingForBathA.type.charAt(0).toUpperCase() + bookingForBathA.type.slice(1);
            bathA.title = `${typeLabel}: ${bookingForBathA.name}`;
            bathA.innerHTML = `<div class="font-semibold text-xs">Badk. A</div><div class="text-xs mt-1 truncate">${bookingForBathA.name}</div>`;
            bathA.style.backgroundColor = bookingColors[bookingForBathA.type] || '#ccc';
            bathA.classList.add('text-white');
            bathA.draggable = true;
            bathA.dataset.bookingId = bookingForBathA.id;
            bathA.dataset.dragType = 'bathroom';
        } else { bathA.innerHTML = 'Badk. A'; }
        
        if (bookingForBathB) {
            const typeLabel = bookingForBathB.type.charAt(0).toUpperCase() + bookingForBathB.type.slice(1);
            bathB.title = `${typeLabel}: ${bookingForBathB.name}`;
            bathB.innerHTML = `<div class="font-semibold text-xs">Badk. B</div><div class="text-xs mt-1 truncate">${bookingForBathB.name}</div>`;
            bathB.style.backgroundColor = bookingColors[bookingForBathB.type] || '#ccc';
            bathB.classList.add('text-white');
            bathB.draggable = true;
            bathB.dataset.bookingId = bookingForBathB.id;
            bathB.dataset.dragType = 'bathroom';
        } else { bathB.innerHTML = 'Badk. B'; }
    }
    
    function renderRequests() {
        requestsList.innerHTML = '';
        if (requests.length === 0) {
            requestsList.innerHTML = '<p class="text-sm text-gray-500">Geen openstaande aanvragen.</p>';
            return;
        }

        const getGuestNameFromNote = (note) => {
            if (!note || !note.includes('Naam:')) return null;
            const match = note.match(/Naam:\s*([^|]+)/);
            return match ? match[1].trim() : null;
        };

        const groupedRequests = requests.reduce((acc, req) => {
            const key = req.groepId || `single-${req.id}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(req);
            return acc;
        }, {});

        for (const key in groupedRequests) {
            const group = groupedRequests[key];
            const isGroup = !!group[0].groepId;

            if (isGroup) {
                const mainRequest = group[0];
                const roomNames = group.map(r => getRoomName(r.roomId) || r.roomId).join(', ');
                const displayEndDate = new Date(new Date(mainRequest.endDate).getTime() - 86400000);

                const groupEl = document.createElement('div');
                groupEl.className = 'p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-center cursor-pointer hover:bg-emerald-100';
                groupEl.dataset.groepId = mainRequest.groepId;

                groupEl.innerHTML = `
                    <div>
                        <p class="font-semibold text-gray-800">${mainRequest.name} <span class="text-sm font-normal text-gray-600">(${group.length} ruimtes)</span></p>
                        <p class="text-sm text-gray-600">
                            <span class="font-medium">${mainRequest.persons || 'Onbekend'}p</span> | Ruimtes: <strong>${roomNames}</strong>
                        </p>
                        <p class="text-sm text-gray-600 mt-1">
                            Periode: ${formatDate(mainRequest.startDate, {day:'numeric', month:'short'})} t/m ${formatDate(displayEndDate, {day:'numeric', month:'short'})}
                        </p>
                    </div>
                    <div class="flex-shrink-0">
                        <button data-groep-id="${mainRequest.groepId}" data-action="review-group" class="px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700">Beoordeel Groep</button>
                    </div>
                `;
                requestsList.appendChild(groupEl);

            } else {
                const req = group[0];
                const guestName = getGuestNameFromNote(req.note);
                const displayEndDate = new Date(new Date(req.endDate).getTime() - 86400000);
                
                const reqEl = document.createElement('div');
                reqEl.className = 'p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center cursor-pointer hover:bg-indigo-100';
                reqEl.dataset.requestId = req.id;
                
                reqEl.innerHTML = `
                    <div>
                        <p class="font-semibold text-gray-800">${guestName || req.name}</p>
                        ${guestName ? `<p class="text-sm text-gray-500">${req.name}</p>` : ''}
                        <p class="text-sm text-gray-600 mt-1">
                            <span class="font-medium">${req.persons || 'Onbekend'}p</span> in <strong>${getRoomName(req.roomId) || 'Onbekend'}</strong> | 
                            Periode: ${formatDate(req.startDate, {day:'numeric', month:'short'})} t/m ${formatDate(displayEndDate, {day:'numeric', month:'short'})}
                        </p>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button data-request-id="${req.id}" data-action="edit" class="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Bewerk</button>
                        <button data-request-id="${req.id}" data-action="reject" class="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Afwijzen</button>
                        <button data-request-id="${req.id}" data-action="approve" class="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Goedkeuren</button>
                    </div>
                `;
                requestsList.appendChild(reqEl);
            }
        }
    }

    function updateBathroomSelectionForQuickForm() {
        const bathroomSelect = document.getElementById('quick-bathroom-select');
        const selectedRadio = document.querySelector('#quick-room-checklist input[name="quick-room-radio"]:checked');
        
        bathroomSelect.disabled = false;
        
        if (!selectedRadio) {
            bathroomSelect.value = "";
            return;
        }
        
        const roomId = selectedRadio.value;
        const room = rooms.find(r => r.id === roomId);

        if (room && room.defaultBathroom === 'eigen') {
            bathroomSelect.value = '';
            bathroomSelect.disabled = true;
        } else {
            bathroomSelect.value = (room && room.defaultBathroom) ? room.defaultBathroom : "";
        }
    }
    function openQuickBookingModal(startStr, endStr, roomId = null, type = 'vrienden') {
        const form = document.getElementById('quick-booking-form');
        form.reset();
        form.querySelector('#quick-start-date').value = startStr;
        form.querySelector('#quick-end-date').value = endStr;
        
        const typeSelect = form.querySelector('#quick-type');
        const personsInput = form.querySelector('#quick-persons');
        const bathroomSelect = form.querySelector('#quick-bathroom-select');
        const nameLabel = form.querySelector('label[for="quick-name"]');
        const modalTitle = quickBookingModal.querySelector('h3');

        if (type === 'blocked') {
            personsInput.parentElement.style.display = 'none';
            bathroomSelect.parentElement.style.display = 'none';
            nameLabel.textContent = 'Reden (optioneel)';
            modalTitle.textContent = 'Periode Blokkeren';
            updateRoomChecklist(startStr, endStr, 'checkbox');
        } else {
            personsInput.parentElement.style.display = 'block';
            bathroomSelect.parentElement.style.display = 'block';
            nameLabel.textContent = 'Naam / Omschrijving';
            modalTitle.textContent = 'Nieuwe Boeking';
            updateRoomChecklist(startStr, endStr, 'radio');
        }

        typeSelect.value = type;
        
        const firstAvailableInput = form.querySelector('#quick-room-checklist input:not(:disabled)');
        if (roomId) {
            const input = form.querySelector(`#quick-input-${roomId}`);
            if (input && !input.disabled) input.checked = true;
        } else if (firstAvailableInput) {
            firstAvailableInput.checked = true;
        }
        updateBathroomSelectionForQuickForm();
        quickBookingModal.style.display = 'flex';
    }
    function updateRoomChecklist(startStr, endStr, inputType = 'radio') {
        const container = document.getElementById('quick-room-checklist');
        container.innerHTML = '';
        
        const roomsToList = (inputType === 'checkbox') ? rooms : rooms.filter(r => r.category === 'slaapkamer' || r.category === 'multifunctioneel');

        if (inputType === 'checkbox') {
            const allRoomsToggleHTML = `
                <div class="flex items-center mb-2 pb-2 border-b">
                    <input id="block-all-rooms-toggle" type="checkbox" class="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500">
                    <label for="block-all-rooms-toggle" class="ml-3 block text-sm font-bold text-gray-900">Alle (beschikbare) ruimtes & badkamers blokkeren</label>
                </div>`;
            container.insertAdjacentHTML('beforeend', allRoomsToggleHTML);
        }

        roomsToList.forEach(room => {
            const isUnavailable = checkOverlap({ startDate: startStr, endDate: endStr, roomId: room.id }, bookings);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center';
            const inputName = `quick-room-${inputType}`;
            const inputId = `quick-input-${room.id}`;
            itemDiv.innerHTML = `<input id="${inputId}" name="${inputName}" type="${inputType}" value="${room.id}" class="h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500" ${isUnavailable ? 'disabled' : ''}><label for="${inputId}" class="ml-3 block text-sm ${isUnavailable ? 'text-gray-400 line-through' : 'text-gray-900'}">${room.name}</label>`;
            container.appendChild(itemDiv);
        });

        if (inputType === 'checkbox') {
            ['A', 'B'].forEach(bathId => {
                const isUnavailable = checkOverlap({ startDate: startStr, endDate: endStr, bathroom: bathId }, bookings);
                const itemDiv = document.createElement('div');
                itemDiv.className = 'flex items-center';
                const inputId = `quick-input-bath-${bathId}`;
                itemDiv.innerHTML = `<input id="${inputId}" name="quick-room-checkbox" type="checkbox" value="bath-${bathId}" class="h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500" ${isUnavailable ? 'disabled' : ''}><label for="${inputId}" class="ml-3 block text-sm ${isUnavailable ? 'text-gray-400 line-through' : 'text-gray-900'}">Badkamer ${bathId}</label>`;
                container.appendChild(itemDiv);
            });

            document.getElementById('block-all-rooms-toggle').addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                container.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(chk => {
                    if (chk.id !== 'block-all-rooms-toggle') chk.checked = isChecked;
                });
            });
        }
    }
    function updateGroupRoomAvailability(startStr, endStr) {
        const checkboxes = document.querySelectorAll('#group-rooms-checkboxes input[name="group-rooms"]');
        checkboxes.forEach(checkbox => {
            const roomId = checkbox.value;
            const bookingForCheck = { startDate: startStr, endDate: endStr, roomId: roomId };
            const isUnavailable = checkOverlap(bookingForCheck, bookings);
            checkbox.disabled = isUnavailable;
            const label = checkbox.nextElementSibling;
            if (isUnavailable) {
                label.classList.add('text-gray-400', 'line-through');
                checkbox.checked = false;
            } else {
                label.classList.remove('text-gray-400', 'line-through');
            }
        });
    }
    function updateEventSpaceAvailability(startStr, endStr) {
        const checkboxes = document.querySelectorAll('#event-spaces-checkboxes input[name="event-spaces"]');
        checkboxes.forEach(checkbox => {
            const roomId = checkbox.value;
            const bookingForCheck = { startDate: startStr, endDate: endStr, roomId: roomId };
            const isUnavailable = checkOverlap(bookingForCheck, bookings);
            checkbox.disabled = isUnavailable;
            const label = checkbox.nextElementSibling;
            if (isUnavailable) {
                label.classList.add('text-gray-400', 'line-through');
                checkbox.checked = false;
            } else {
                label.classList.remove('text-gray-400', 'line-through');
            }
        });
    }
    function openBookingModal(event) {
        const isRequest = event.status === 'aangevraagd';
        const roomOptions = rooms
            .filter(r => r.category === 'slaapkamer' || r.category === 'multifunctioneel')
            .map(room => `<option value="${room.id}" ${room.id === event.roomId ? 'selected' : ''}>${room.name}</option>`)
            .join('');
        
        const typeOptions = [
            { value: 'vrienden', label: 'Vrienden' }, { value: 'airbnb', label: 'Airbnb' },
            { value: 'blocked', label: 'Geblokkeerd' }, { value: 'note', label: 'Notitie' },
        ];

        const isRoomC = event.roomId === 'kamer-c';
        const isAirbnb = event.type === 'airbnb';

        let typeSelectorHTML = `
            <div>
                <label for="edit-type" class="block text-sm font-medium text-gray-700">Type</label>
                <select id="edit-type" class="mt-1 input" ${isAirbnb ? 'disabled' : ''}>
                    ${typeOptions.map(opt => `<option value="${opt.value}" ${event.type === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                </select>
            </div>
        `;
        
        let noteFieldsHTML = '';
        let groupWarningHTML = '';
        if (event.groepId) {
            typeSelectorHTML = '';
            groupWarningHTML = `<div class="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700"><p><b>Let op:</b> Je bewerkt een onderdeel van een groepsboeking. Wijzigingen in naam, datums en groepsnotitie worden voor de <strong>hele groep</strong> doorgevoerd.</p></div>`;
            noteFieldsHTML = `<div><label for="edit-group-note" class="block text-sm font-medium text-gray-700">Groepsnotitie</label><input type="text" id="edit-group-note" class="mt-1 input" value="${event.groepsnotitie || ''}"></div><div><label for="edit-note" class="block text-sm font-medium text-gray-700">Notitie voor ${getRoomName(event.roomId)} (optioneel)</label><input type="text" id="edit-note" class="mt-1 input" value="${event.note || ''}"></div>`;
        } else {
            noteFieldsHTML = `<div><label for="edit-note" class="block text-sm font-medium text-gray-700">Notitie</label><input type="text" id="edit-note" class="mt-1 input" value="${event.note || ''}"></div>`;
        }
        
        const isNote = event.type === 'note';
        if (isNote) { noteFieldsHTML = ''; }

        bookingModal.innerHTML = `<div class="modal-content">
            <h3 class="text-lg font-semibold mb-4">${isRequest ? 'Aanvraag Beoordelen' : (isNote ? 'Notitie Bewerken' : 'Boeking Bewerken')}</h3>
            <form id="edit-booking-form" class="space-y-4">
                <input type="hidden" id="edit-booking-id" value="${event.id}">
                <input type="hidden" id="edit-groep-id" value="${event.groepId || ''}">
                ${groupWarningHTML}
                <div><label for="edit-name" class="block text-sm font-medium text-gray-700">${isNote ? 'Notitie' : 'Gast (E-mail)'}</label><input type="text" id="edit-name" required class="mt-1 input" value="${event.name || ''}"></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label for="edit-start-date" class="block text-sm font-medium text-gray-700">Startdatum</label><input type="date" id="edit-start-date" required class="mt-1 input" value="${event.startDate}"></div>
                    <div><label for="edit-end-date" class="block text-sm font-medium text-gray-700">Einddatum</label><input type="date" id="edit-end-date" required class="mt-1 input" value="${event.endDate}"></div>
                </div>
                <div class="grid grid-cols-2 gap-4 ${isNote ? 'hidden' : ''}">
                    <div><label for="edit-room-select" class="block text-sm font-medium text-gray-700">Kamer</label><select id="edit-room-select" class="mt-1 input" ${isRequest ? '' : 'disabled'}><option value="">Geen specifieke kamer</option>${roomOptions}</select></div>
                    ${!event.groepId ? typeSelectorHTML : '<div></div>'}
                </div>
                <div class="grid grid-cols-2 gap-4 ${isNote ? 'hidden' : ''}">
                    <div><label for="edit-bathroom-select" class="block text-sm font-medium text-gray-700">Badkamer</label><select id="edit-bathroom-select" class="mt-1 input" ${isRoomC ? 'disabled' : ''}><option value="">${isRoomC ? 'Eigen badkamer' : 'N.v.t.'}</option><option value="A" ${event.bathroom === 'A' ? 'selected' : ''}>Badkamer A</option><option value="B" ${event.bathroom === 'B' ? 'selected' : ''}>Badkamer B</option></select></div>
                    <div></div>
                </div>
                ${noteFieldsHTML}
                <div class="mt-6 flex justify-between items-center">
                    <button type="button" id="delete-booking-btn" class="text-sm font-semibold py-2 px-4 rounded-md ${isRequest ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-600 text-white hover:bg-red-700'}">${isRequest ? 'Aanvraag Afwijzen' : 'Verwijderen'}</button>
                    <div class="flex gap-3">
                        <button type="button" class="modal-close-btn px-4 py-2 bg-gray-200 rounded-md">Annuleren</button>
                        <button type="submit" class="px-4 py-2 text-white rounded-md ${isRequest ? 'bg-green-600 hover:bg-green-700' : 'bg-[#C58A4A] hover:bg-[#b07b41]'}">${isRequest ? 'Goedkeuren & Opslaan' : 'Wijzigingen Opslaan'}</button>
                    </div>
                </div>
            </form>
        </div>`;
        
        bookingModal.style.display = 'flex';
        bookingModal.querySelector('.modal-close-btn').addEventListener('click', () => bookingModal.style.display = 'none');
        bookingModal.querySelector('#edit-booking-form').addEventListener('submit', saveBookingChanges);
        bookingModal.querySelector('#delete-booking-btn').addEventListener('click', deleteBooking);
    }
    async function saveBookingChanges(e) {
        e.preventDefault();
        const form = e.target;
        const bookingIdNum = parseInt(form.querySelector('#edit-booking-id').value, 10);
        const originalBooking = formattedEvents.find(ev => ev.id === bookingIdNum);
        if (!originalBooking) {
            alert('Fout: Kon de originele boeking niet vinden.');
            return;
        }

        const isRequest = originalBooking.status === 'aangevraagd';
        const groepId = form.querySelector('#edit-groep-id').value;
        
        const commonData = {
            start_datum: form.querySelector('#edit-start-date').value,
            eind_datum: form.querySelector('#edit-end-date').value,
            gast_naam: form.querySelector('#edit-name').value,
        };
        selectedDateStr = commonData.start_datum;

        if (groepId) {
            const groupUpdateData = { ...commonData, groepsnotitie: form.querySelector('#edit-group-note').value };
            const { error: groupError } = await supabaseClient.from('reserveringen').update(groupUpdateData).eq('groep_id', groepId);
            if (groupError) { console.error('Fout bij bijwerken groepsdata:', groupError); alert('Kon de groepsboeking niet bijwerken.'); return; }
            const roomUpdateData = { notities: form.querySelector('#edit-note').value, badkamer: form.querySelector('#edit-bathroom-select').value };
            const { error: roomError } = await supabaseClient.from('reserveringen').update(roomUpdateData).eq('id', bookingIdNum);
            if (roomError) { console.error('Fout bij bijwerken kamerdata:', roomError); alert('Kon de specifieke kamer niet bijwerken.'); return; }
        } else {
            const kamer = form.querySelector('#edit-room-select')?.value;
            const singleData = {
                ...commonData,
                kamer: kamer,
                badkamer: kamer === 'kamer-c' ? null : form.querySelector('#edit-bathroom-select')?.value,
                notities: form.querySelector('#edit-note')?.value,
                bron: form.querySelector('#edit-type')?.value
            };
            
            const roomCheck = { id: bookingIdNum, startDate: singleData.start_datum, endDate: singleData.eind_datum, roomId: singleData.kamer };
            if (singleData.kamer && checkOverlap(roomCheck, bookings)) {
                alert(`Fout: Kamer "${getRoomName(singleData.kamer)}" is al bezet in de geselecteerde periode. Kies een andere kamer.`);
                return;
            }
            const bathroomCheck = { id: bookingIdNum, startDate: singleData.start_datum, endDate: singleData.eind_datum, bathroom: singleData.badkamer };
            if (singleData.badkamer && checkOverlap(bathroomCheck, bookings)) {
                alert(`Fout: Badkamer ${singleData.badkamer} is al bezet in de geselecteerde periode.`);
                return;
            }

            if (isRequest) {
                singleData.status = 'bevestigd';
            }
            
            const { error } = await supabaseClient.from('reserveringen').update(singleData).match({ id: bookingIdNum });
            if (error) { console.error('Fout bij bijwerken:', error); alert('Kon boeking niet bijwerken.'); return; }
        }
        
        await refreshDataAndRender();
    }
    function deleteBooking() {
        const bookingId = bookingModal.querySelector('#edit-booking-id').value;
        const groepId = bookingModal.querySelector('#edit-groep-id').value;

        if (groepId) {
            const event = formattedEvents.find(e => e.id == parseInt(bookingId));
            if (!event) return;
            deleteChoiceRoomName.textContent = getRoomName(event.roomId);
            deleteChoiceGroupName.textContent = event.name;
            deleteSingleBtn.dataset.bookingId = bookingId;
            deleteGroupBtn.dataset.groepId = groepId;
            deleteChoiceModal.style.display = 'flex';
        } else {
            const originalBooking = formattedEvents.find(e => e.id == bookingId);
            const confirmMessage = originalBooking && originalBooking.status === 'aangevraagd' 
                ? 'Weet je zeker dat je deze aanvraag wilt afwijzen en verwijderen?' 
                : 'Weet je zeker dat je deze boeking wilt verwijderen?';

            if (confirm(confirmMessage)) {
                (async () => {
                    const { error } = await supabaseClient.from('reserveringen').delete().match({ id: bookingId });
                    if (error) { console.error('Fout bij verwijderen:', error); alert('Kon item niet verwijderen.'); } 
                    else { await refreshDataAndRender(); }
                })();
            }
        }
    }

    let dragSourceElement = null;

    function handleFloorplanDragStart(e) {
        const draggable = e.target.closest('[draggable="true"]');
        if (!draggable) return;
        dragSourceElement = draggable;
        setTimeout(() => dragSourceElement.classList.add('dragging'), 0);
    }

    function handleFloorplanDragEnd() {
        if (dragSourceElement) {
            dragSourceElement.classList.remove('dragging');
        }
        dragSourceElement = null;
        document.querySelectorAll('.drag-over-valid').forEach(el => el.classList.remove('drag-over-valid'));
    }

    function handleFloorplanDragOver(e) {
        e.preventDefault();
        const targetElement = e.target.closest('.floorplan-room, .bath-sub-item');
        document.querySelectorAll('.drag-over-valid').forEach(el => el.classList.remove('drag-over-valid'));
        if (!targetElement || !dragSourceElement || targetElement === dragSourceElement) return;

        const sourceBooking = formattedEvents.find(ev => ev.id == dragSourceElement.dataset.bookingId);
        if(!sourceBooking) return;
        
        const targetIsOccupied = !!targetElement.dataset.bookingId;
        const targetRoomId = targetElement.id.replace('fp-', '').replace('-container', '');
        const targetRoom = rooms.find(r => r.id === targetRoomId);

        let isValidDrop = false;

        if (targetIsOccupied) { // WISSELEN
            if (dragSourceElement.dataset.dragType === targetElement.dataset.dragType) {
                isValidDrop = true;
            }
        } else { // VERPLAATSEN
            if (dragSourceElement.dataset.dragType === 'guest' && targetRoom) {
                const isEvent = sourceBooking.type === 'event';
                if (!isEvent && (targetRoom.category === 'slaapkamer' || targetRoom.category === 'multifunctioneel')) {
                    isValidDrop = true;
                }
                if (isEvent && (targetRoom.category === 'evenement' || targetRoom.category === 'multifunctioneel')) {
                    isValidDrop = true;
                }
            }
        }
        
        if (isValidDrop) {
            targetElement.classList.add('drag-over-valid');
        }
    }

    function handleFloorplanDragLeave(e) {
        e.target.closest('.floorplan-room, .bath-sub-item')?.classList.remove('drag-over-valid');
    }

    async function handleFloorplanDrop(e) {
        e.preventDefault();
        const dropTarget = e.target.closest('.drag-over-valid');
        if (!dropTarget || !dragSourceElement) return;
        
        dropTarget.classList.remove('drag-over-valid');

        const sourceBookingId = parseInt(dragSourceElement.dataset.bookingId, 10);
        const sourceBooking = formattedEvents.find(ev => ev.id === sourceBookingId);
        if (!sourceBooking) return;
        
        if (dropTarget.dataset.bookingId) { // --- HET IS EEN WISSEL ---
            const targetBookingId = parseInt(dropTarget.dataset.bookingId, 10);
            const targetBooking = formattedEvents.find(ev => ev.id === targetBookingId);
            if (!targetBooking) return;

            swapConfirmBtn.dataset.sourceId = sourceBooking.id;
            swapConfirmBtn.dataset.targetId = targetBooking.id;
            swapConfirmBtn.dataset.dragType = dragSourceElement.dataset.dragType;

            let title = 'Wisselen?';
            let text = '';
            
            if (dragSourceElement.dataset.dragType === 'guest') {
                text = `Weet je zeker dat je <strong>${sourceBooking.name}</strong> (in ${getRoomName(sourceBooking.roomId)}) wilt wisselen met <strong>${targetBooking.name}</strong> (in ${getRoomName(targetBooking.roomId)})?`;
            } else {
                text = `Weet je zeker dat je de badkamers wilt wisselen tussen <strong>${sourceBooking.name}</strong> en <strong>${targetBooking.name}</strong>?`;
            }

            swapConfirmTitle.textContent = title;
            swapConfirmText.innerHTML = text;
            swapConfirmModal.style.display = 'flex';

        } else { // --- HET IS EEN VERPLAATSING ---
            const newRoomId = dropTarget.id.replace('fp-', '');
            const newRoomName = getRoomName(newRoomId);

            moveConfirmBtn.dataset.bookingId = sourceBookingId;
            moveConfirmBtn.dataset.newRoomId = newRoomId;

            moveConfirmTitle.textContent = `Boeking Verplaatsen?`;
            moveConfirmText.innerHTML = `Weet je zeker dat je <strong>${sourceBooking.name}</strong> wilt verplaatsen naar <strong>${newRoomName}</strong>?`;
            moveConfirmModal.style.display = 'flex';
        }
    }

    async function executeGuestSwap(sourceId, targetId) {
        const source = formattedEvents.find(e => e.id === sourceId);
        const target = formattedEvents.find(e => e.id === targetId);
        if (!source || !target) return;

        const swapMap = {
            name: 'gast_naam', persons: 'aantal_personen', bathroom: 'badkamer',
            note: 'notities', groepsnotitie: 'groepsnotitie', groepId: 'groep_id',
            type: 'bron', status: 'status'
        };
        const sourceUpdate = {};
        const targetUpdate = {};

        for (const prop of Object.keys(swapMap)) {
            const dbColumn = swapMap[prop];
            sourceUpdate[dbColumn] = target[prop] || null;
            targetUpdate[dbColumn] = source[prop] || null;
        }

        const { error: sourceError } = await supabaseClient.from('reserveringen').update(sourceUpdate).match({ id: source.id });
        const { error: targetError } = await supabaseClient.from('reserveringen').update(targetUpdate).match({ id: target.id });

        if (sourceError || targetError) {
            console.error("Fout bij wisselen gasten:", sourceError, targetError);
            alert("Er is een fout opgetreden bij het wisselen.");
        }
    }

    async function executeBathroomSwap(sourceId, targetId) {
        const source = formattedEvents.find(e => e.id === sourceId);
        const target = formattedEvents.find(e => e.id === targetId);
        if (!source || !target) return;

        const { error: sourceError } = await supabaseClient.from('reserveringen').update({ badkamer: target.bathroom }).match({ id: source.id });
        const { error: targetError } = await supabaseClient.from('reserveringen').update({ badkamer: source.bathroom }).match({ id: target.id });

        if (sourceError || targetError) {
            console.error("Fout bij wisselen badkamers:", sourceError, targetError);
            alert("Er is een fout opgetreden bij het wisselen.");
        }
    }

    async function executeMove(bookingId, newRoomId) {
        const { error } = await supabaseClient.from('reserveringen').update({ kamer: newRoomId }).match({ id: bookingId });
        if (error) {
            console.error("Fout bij verplaatsen:", error);
            alert("Er is een fout opgetreden bij het verplaatsen.");
        }
    }
    
    document.getElementById('prev-month-btn').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderAll(); });
    document.getElementById('next-month-btn').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderAll(); });
    document.getElementById('prev-day').addEventListener('click', () => { const d = new Date(selectedDateStr); d.setDate(d.getDate() - 1); selectedDateStr = d.toISOString().slice(0,10); renderAll(); });
    document.getElementById('next-day').addEventListener('click', () => { const d = new Date(selectedDateStr); d.setDate(d.getDate() + 1); selectedDateStr = d.toISOString().slice(0,10); renderAll(); });
    floorplanDatePicker.addEventListener('change', (e) => { selectedDateStr = e.target.value; renderAll(); });
    
    floorplanContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.floorplan-room, .bath-sub-item');
        if (!target) return;

        if (target.classList.contains('room-free') || (!target.dataset.bookingId && target.classList.contains('floorplan-room'))) {
            handleFloorplanClick(e, target);
        } else if (target.dataset.bookingId) {
            const event = formattedEvents.find(ev => ev.id == target.dataset.bookingId);
            if (event) openBookingModal(event);
        }
    });
    
    function handleFloorplanClick(e, roomEl) {
        const roomId = roomEl.id.replace('fp-', '');
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;
        const date = floorplanDatePicker.value;
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(startDate.getDate() + 1);
        if (room.id === 'kapel') { 
            e.stopPropagation();
            const rect = roomEl.getBoundingClientRect();
            showKapelContextMenu(rect.right, rect.top, startDate, endDate);
        } else if (room.category === 'evenement') {
            handleMenuAction('new-event', startDate, endDate);
        } else if (room.category === 'slaapkamer') {
            openQuickBookingModal(startDate.toISOString().slice(0,10), endDate.toISOString().slice(0,10), room.id, 'vrienden');
        }
    }

    floorplanContainer.addEventListener('dragstart', handleFloorplanDragStart);
    floorplanContainer.addEventListener('dragend', handleFloorplanDragEnd);
    floorplanContainer.addEventListener('dragover', handleFloorplanDragOver);
    floorplanContainer.addEventListener('dragleave', handleFloorplanDragLeave);
    floorplanContainer.addEventListener('drop', handleFloorplanDrop);

    document.getElementById('quick-booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const typeValue = form.querySelector('#quick-type').value;

        const newBookings = [];
        const baseData = {
            start_datum: form.querySelector('#quick-start-date').value,
            eind_datum: form.querySelector('#quick-end-date').value,
            gast_naam: form.querySelector('#quick-name').value || 'Blokkade',
            bron: typeValue,
            status: 'bevestigd'
        };
        selectedDateStr = baseData.start_datum;

        if (typeValue === 'blocked') {
            const selectedCheckboxes = form.querySelectorAll('input[name="quick-room-checkbox"]:checked');
            if (selectedCheckboxes.length === 0) { alert('Selecteer alstublieft ten minste één ruimte om te blokkeren.'); return; }
            const newGroepId = selectedCheckboxes.length > 1 ? crypto.randomUUID() : null;
            selectedCheckboxes.forEach(checkbox => {
                const value = checkbox.value;
                const booking = { ...baseData, groep_id: newGroepId, aantal_personen: null };
                if (value.startsWith('bath-')) { booking.badkamer = value.replace('bath-', ''); } 
                else { booking.kamer = value; }
                newBookings.push(booking);
            });
        } else {
            const personsValue = form.querySelector('#quick-persons').value;
            if (!personsValue || personsValue < 1) { alert('Vul alstublieft een geldig aantal personen in.'); return; }
            const selectedRadio = form.querySelector('input[name="quick-room-radio"]:checked');
            if (!selectedRadio) { alert('Selecteer alstublieft een kamer.'); return; }
            newBookings.push({
                ...baseData,
                kamer: selectedRadio.value,
                badkamer: selectedRadio.value === 'kamer-c' ? null : form.querySelector('#quick-bathroom-select').value,
                aantal_personen: parseInt(personsValue)
            });
        }
        
        const { error } = await supabaseClient.from('reserveringen').insert(newBookings);
        if (error) { console.error('Fout bij opslaan:', error); alert('Er is een fout opgetreden.'); } 
        else { await refreshDataAndRender(); }
    });
    
    document.getElementById('quick-room-checklist').addEventListener('change', (e) => {
        if (e.target.name === 'quick-room-radio') {
            updateBathroomSelectionForQuickForm();
        }
    });
    
    document.getElementById('group-booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const groupName = form.querySelector('#group-name').value;
        const groupNote = form.querySelector('#group-note').value;
        const selectedCheckboxes = form.querySelectorAll('input[name="group-rooms"]:checked');
        if (!groupDateRange.start || !groupDateRange.end) { alert('Selecteer alstublieft een periode.'); return; }
        if (selectedCheckboxes.length === 0) { alert('Selecteer alstublieft ten minste één kamer.'); return; }
        
        const conflictingRooms = [];
        for (const checkbox of selectedCheckboxes) {
            const bookingForCheck = { startDate: groupDateRange.start, endDate: groupDateRange.end, roomId: checkbox.value };
            if (checkOverlap(bookingForCheck, bookings)) { conflictingRooms.push(getRoomName(checkbox.value)); }
        }
        if (conflictingRooms.length > 0) { alert(`Fout: De volgende kamers zijn al bezet in de geselecteerde periode:\n- ${conflictingRooms.join('\n- ')}`); return; }

        const newBookings = [];
        const newGroepId = crypto.randomUUID();
        selectedCheckboxes.forEach(checkbox => { 
            newBookings.push({ 
                start_datum: groupDateRange.start, eind_datum: groupDateRange.end, gast_naam: groupName, bron: 'group', 
                kamer: checkbox.value, groepsnotitie: groupNote, status: 'bevestigd', groep_id: newGroepId
            }); 
        });

        selectedDateStr = groupDateRange.start;
        const { error } = await supabaseClient.from('reserveringen').insert(newBookings);
        if (error) { console.error('Fout bij opslaan groepsboeking:', error); alert('Er is een fout opgetreden.'); } 
        else { await refreshDataAndRender(); }
    });
    
    document.getElementById('event-booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const eventName = form.querySelector('#event-name').value;
        const selectedCheckboxes = form.querySelectorAll('input[name="event-spaces"]:checked');
        if (!eventDateRange.start || !eventDateRange.end) { alert('Selecteer alstublieft een periode voor het evenement.'); return; }
        if (selectedCheckboxes.length === 0) { alert('Selecteer alstublieft ten minste één ruimte voor het evenement.'); return; }
        const conflictingSpaces = [];
        for (const checkbox of selectedCheckboxes) {
            const bookingForCheck = { startDate: eventDateRange.start, endDate: eventDateRange.end, roomId: checkbox.value };
            if (checkOverlap(bookingForCheck, bookings)) { conflictingSpaces.push(getRoomName(checkbox.value)); }
        }
        if (conflictingSpaces.length > 0) { alert(`Fout: De volgende ruimtes zijn al bezet in de geselecteerde periode:\n- ${conflictingSpaces.join('\n- ')}`); return; }
        const newEventBookings = [];
        const newGroepId = crypto.randomUUID();
        selectedCheckboxes.forEach(checkbox => {
            newEventBookings.push({
                start_datum: eventDateRange.start, eind_datum: eventDateRange.end, gast_naam: eventName, bron: 'event', 
                kamer: checkbox.value, status: 'bevestigd', groep_id: newGroepId
            });
        });

        selectedDateStr = eventDateRange.start;
        const { error } = await supabaseClient.from('reserveringen').insert(newEventBookings);
        if (error) { console.error('Fout bij opslaan evenement:', error); alert('Er is een fout opgetreden bij het boeken van het evenement.'); } 
        else { await refreshDataAndRender(); }
    });

    deleteSingleBtn.addEventListener('click', async () => {
        const bookingId = deleteSingleBtn.dataset.bookingId;
        if (!bookingId) return;
        const { error } = await supabaseClient.from('reserveringen').delete().match({ id: bookingId });
        if (error) { console.error('Fout bij verwijderen enkele boeking:', error); alert('Kon de boeking niet verwijderen.'); }
        else { await refreshDataAndRender(); }
    });

    deleteGroupBtn.addEventListener('click', async () => {
        const groepId = deleteGroupBtn.dataset.groepId;
        if (!groepId) return;
        const { error } = await supabaseClient.from('reserveringen').delete().eq('groep_id', groepId);
        if (error) { console.error('Fout bij verwijderen groep:', error); alert('Kon de groep/event niet verwijderen.'); }
        else { await refreshDataAndRender(); }
    });

    swapConfirmBtn.addEventListener('click', async (e) => {
        const { sourceId, targetId, dragType } = e.currentTarget.dataset;
        if (!sourceId || !targetId || !dragType) return;
        if (dragType === 'guest') { await executeGuestSwap(parseInt(sourceId), parseInt(targetId)); } 
        else { await executeBathroomSwap(parseInt(sourceId), parseInt(targetId)); }
        await refreshDataAndRender();
    });

    moveConfirmBtn.addEventListener('click', async (e) => {
        const bookingId = parseInt(e.currentTarget.dataset.bookingId);
        const newRoomId = e.currentTarget.dataset.newRoomId;
        if (!bookingId || !newRoomId) return;
        await executeMove(bookingId, newRoomId);
        await refreshDataAndRender();
    });

    const noteModalText = document.getElementById('note-modal-text');
    const saveNoteBtn = document.getElementById('save-note-btn');

    async function saveNote() {
        const noteText = noteModalText.value;
        if (!noteText.trim()) return;
        const dateStr = dayModal.dataset.date;
        if (!dateStr) return;
        const startDate = new Date(dateStr);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
        const newNote = {
            start_datum: dateStr, eind_datum: endDate.toISOString().slice(0, 10),
            gast_naam: noteText, bron: 'note', status: 'bevestigd'
        };
        const { error } = await supabaseClient.from('reserveringen').insert([newNote]);
        if (error) { console.error("Fout bij opslaan notitie:", error); alert("Kon de notitie niet opslaan."); } 
        else { noteModalText.value = ''; await refreshDataAndRender(); }
    }

    saveNoteBtn.addEventListener('click', saveNote);
    noteModalText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveNote(); }
    });

    window.addEventListener('click', (e) => {
        if (dragJustEnded) return; 
        if (contextMenu.style.display === 'block' && !contextMenu.contains(e.target)) hideContextMenu();
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', () => {
        btn.closest('.modal').style.display = 'none';
    }));

    const groupReviewModal = document.getElementById('group-review-modal');

    async function openGroupReviewModal(groepId) {
        const groupRequests = requests.filter(r => r.groepId === groepId);
        if (groupRequests.length === 0) return;

        const mainRequest = groupRequests[0];
        
        document.getElementById('group-modal-title').textContent = `Groepsaanvraag Beoordelen: ${mainRequest.name}`;
        const contactMatch = mainRequest.groepsnotitie.match(/Contact:\s*([^|]+)/);
        document.getElementById('group-modal-contact').textContent = contactMatch ? contactMatch[1].trim() : 'Niet opgegeven';
        const displayEndDate = new Date(new Date(mainRequest.endDate).getTime() - 86400000);
        document.getElementById('group-modal-period').textContent = `${formatDate(mainRequest.startDate, {day:'numeric', month:'short'})} t/m ${formatDate(displayEndDate, {day:'numeric', month:'short'})}`;
        document.getElementById('group-modal-persons').textContent = mainRequest.persons;
        document.getElementById('group-modal-notes').value = mainRequest.groepsnotitie;

        const roomsListContainer = document.getElementById('group-modal-rooms-list');
        roomsListContainer.innerHTML = '';
        let hasConflict = false;

        groupRequests.forEach(req => {
            const isBooked = checkOverlap({ startDate: req.startDate, endDate: req.endDate, roomId: req.roomId }, bookings);
            if (isBooked) {
                hasConflict = true;
            }

            const roomEl = document.createElement('div');
            roomEl.className = 'p-2 border-b flex justify-between items-center';
            roomEl.innerHTML = `
                <span>${getRoomName(req.roomId) || req.roomId}</span>
                ${isBooked 
                    ? '<span class="font-semibold text-sm text-white bg-red-500 px-2 py-1 rounded-full">Conflict</span>'
                    : '<span class="font-semibold text-sm text-white bg-green-500 px-2 py-1 rounded-full">Beschikbaar</span>'
                }
            `;
            roomsListContainer.appendChild(roomEl);
        });

        const approveBtn = document.getElementById('group-approve-all-btn');
        const rejectBtn = document.getElementById('group-reject-all-btn');
        const feedbackEl = document.getElementById('group-modal-feedback');

        approveBtn.disabled = hasConflict;
        rejectBtn.onclick = async () => {
            if (confirm(`Weet je zeker dat je de hele groepsaanvraag van "${mainRequest.name}" wilt afwijzen en verwijderen?`)) {
                const { error } = await supabaseClient.from('reserveringen').delete().eq('groep_id', groepId);
                if (error) { alert('Fout bij verwijderen: ' + error.message); }
                else { await refreshDataAndRender(); }
            }
        };

        approveBtn.onclick = async () => {
            if (confirm(`Weet je zeker dat je de hele groepsaanvraag van "${mainRequest.name}" wilt goedkeuren?`)) {
                const { error } = await supabaseClient.from('reserveringen').update({ status: 'bevestigd' }).eq('groep_id', groepId);
                if (error) { alert('Fout bij goedkeuren: ' + error.message); }
                else { await refreshDataAndRender(); }
            }
        };

        if(hasConflict) {
            feedbackEl.className = 'text-center p-3 rounded-md bg-red-100 text-red-800 text-sm block';
            feedbackEl.textContent = 'Goedkeuren is niet mogelijk omdat er een conflict is met een of meerdere ruimtes.';
        } else {
            feedbackEl.className = 'text-center p-3 rounded-md bg-green-100 text-green-800 text-sm block';
            feedbackEl.textContent = 'Alle ruimtes zijn beschikbaar. De groep kan worden goedgekeurd.';
        }

        groupReviewModal.style.display = 'flex';
    }

    requestsList.addEventListener('click', async (e) => {
        const targetElement = e.target;
        const button = targetElement.closest('button');
        const groupCard = targetElement.closest('div[data-groep-id]');

        if (button?.dataset.action === 'review-group' || (groupCard && !button)) {
            const groepId = button?.dataset.groepId || groupCard?.dataset.groepId;
            if (groepId) {
                openGroupReviewModal(groepId);
                return;
            }
        }
        
        if (button) {
            e.stopPropagation(); 
            const requestId = button.dataset.requestId;
            const action = button.dataset.action;
            if (!requestId || !action || action === 'review-group') return;
            
            const requestData = requests.find(r => r.id == requestId);
            if (!requestData) return;

            if (action === 'edit') {
                openBookingModal(requestData);
            } else if (action === 'approve') {
                const bookingForCheck = {
                    id: requestData.id,
                    startDate: requestData.startDate,
                    endDate: requestData.endDate,
                    roomId: requestData.roomId,
                    bathroom: requestData.bathroom
                };

                if (checkOverlap(bookingForCheck, bookings)) {
                    alert(`Goedkeuren mislukt: De kamer (${getRoomName(requestData.roomId)}) of toegewezen badkamer is al bezet in de geselecteerde periode door een andere bevestigde boeking.`);
                    return;
                }

                if (confirm('Weet je zeker dat je deze aanvraag wilt goedkeuren? De status wordt "bevestigd".')) {
                    const { error } = await supabaseClient.from('reserveringen').update({ status: 'bevestigd' }).eq('id', requestId);
                    if (error) { alert('Fout bij het goedkeuren: ' + error.message); } 
                    else { await refreshDataAndRender(); }
                }
            } else if (action === 'reject') {
                if (confirm('Weet je zeker dat je deze aanvraag permanent wilt afwijzen?')) {
                    const { error } = await supabaseClient.from('reserveringen').delete().eq('id', requestId);
                    if (error) { alert('Fout bij het afwijzen: ' + error.message); } 
                    else { await refreshDataAndRender(); }
                }
            }
        } 
        else if (targetElement.closest('div[data-request-id]')) {
             const requestId = targetElement.closest('div[data-request-id]').dataset.requestId;
             const requestData = requests.find(r => r.id == requestId);
             if (requestData) {
                 openBookingModal(requestData);
             }
        }
    });

    await refreshDataAndRender();
    populateFormElements();
});

if (typeof crypto.randomUUID === 'undefined') {
  crypto.randomUUID = function() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  };
}