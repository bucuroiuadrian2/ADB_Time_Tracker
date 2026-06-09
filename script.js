// State
let clockInTime = null;
let sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
let currentMonth = new Date();
let selectedDate = null;
let currentSessionName = 'Work';
let currentLocation = 'Office';
let expectedWorkHours = 8;
let clockInChart = null;
let clockOutChart = null;
let notificationShown = false;

// Convert stored sessions back to Date objects
sessions = sessions.map(s => ({
    ...s,
    clockIn: new Date(s.clockIn),
    clockOut: new Date(s.clockOut)
}));

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Session name handling
function handleSessionNameChange() {
    const select = document.getElementById('session-name-select');
    const customInput = document.getElementById('custom-session-name');
    if (select.value === 'Custom') {
        customInput.style.display = 'block';
        customInput.focus();
        currentSessionName = customInput.value || 'Custom';
    } else {
        customInput.style.display = 'none';
        currentSessionName = select.value;
    }
}

// Location handling
function setLocation(location) {
    currentLocation = location;
    document.getElementById('office-btn').classList.toggle('active', location === 'Office');
    document.getElementById('home-btn').classList.toggle('active', location === 'Home');
}

// Initialize
window.addEventListener('DOMContentLoaded', function() {
    const customInput = document.getElementById('custom-session-name');
    if (customInput) {
        customInput.addEventListener('input', function() {
            currentSessionName = this.value || 'Custom';
        });
    }
    const workHoursInput = document.getElementById('work-hours-input');
    if (workHoursInput) {
        workHoursInput.addEventListener('change', function() {
            expectedWorkHours = parseFloat(this.value) || 8;
        });
    }
});

// Format functions
function formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function formatTimeShort(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

function formatDate(date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

function formatDuration(ms) {
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${h}h ${m}m ${s}s`;
}

function formatDurationShort(ms) {
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Clock In
function clockIn() {
    const manualTimeInput = document.getElementById('manual-clock-in');
    const manualTime = manualTimeInput.value;

    if (manualTime) {
        const now = new Date();
        const [hours, minutes] = manualTime.split(':');
        clockInTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
    } else {
        clockInTime = new Date();
    }

    expectedWorkHours = parseFloat(document.getElementById('work-hours-input').value) || 8;
    notificationShown = false;

    localStorage.setItem('activeClockIn', clockInTime.toISOString());
    localStorage.setItem('activeSessionName', currentSessionName);
    localStorage.setItem('activeLocation', currentLocation);
    localStorage.setItem('expectedWorkHours', expectedWorkHours);

    document.getElementById('status-dot').classList.add('active');
    document.getElementById('status-label').textContent = 'Active Session';
    document.getElementById('status-text').textContent = `Started at ${formatTime(clockInTime)}`;
    document.getElementById('clock-in-btn').disabled = true;
    document.getElementById('clock-out-btn').disabled = false;
    document.getElementById('check-btn').disabled = false;
    document.getElementById('manual-time-section').style.display = 'none';
    document.getElementById('elapsed-time').textContent = '--:--:--';
    document.getElementById('remaining-time').textContent = '--:--:--';
    manualTimeInput.value = '';

    updateExpectedClockOut();
    document.getElementById('clock-out-info').style.display = 'block';

    startNotificationCheck();
}

// Clock Out
function clockOut() {
    if (!clockInTime) return;

    const clockOutTime = new Date();
    const duration = clockOutTime - clockInTime;

    sessions.push({
        clockIn: clockInTime,
        clockOut: clockOutTime,
        duration: formatDuration(duration),
        name: currentSessionName,
        location: currentLocation
    });

    localStorage.setItem('sessions', JSON.stringify(sessions));
    localStorage.removeItem('activeClockIn');
    localStorage.removeItem('activeSessionName');
    localStorage.removeItem('activeLocation');
    localStorage.removeItem('expectedWorkHours');

    clockInTime = null;
    notificationShown = false;

    if (window.notificationInterval) clearInterval(window.notificationInterval);

    document.getElementById('status-dot').classList.remove('active');
    document.getElementById('status-label').textContent = 'No Active Session';
    document.getElementById('status-text').textContent = 'Ready to clock in';
    document.getElementById('elapsed-time').textContent = '--:--:--';
    document.getElementById('remaining-time').textContent = '--:--:--';
    document.getElementById('clock-in-btn').disabled = false;
    document.getElementById('clock-out-btn').disabled = true;
    document.getElementById('check-btn').disabled = true;
    document.getElementById('manual-time-section').style.display = 'block';
    document.getElementById('clock-out-info').style.display = 'none';

    renderHistory();
    renderCalendar();
}

// Check Duration
function checkDuration() {
    if (!clockInTime) return;

    const now = new Date();
    const elapsed = now - clockInTime;
    const expectedMs = expectedWorkHours * 60 * 60 * 1000;
    const remaining = expectedMs - elapsed;

    document.getElementById('elapsed-time').textContent = formatDurationShort(elapsed);
    document.getElementById('remaining-time').textContent = remaining > 0 ? formatDurationShort(remaining) : '00:00:00';

    updateExpectedClockOut();
}

function updateExpectedClockOut() {
    if (!clockInTime) return;
    const expectedMs = expectedWorkHours * 60 * 60 * 1000;
    const expectedClockOut = new Date(clockInTime.getTime() + expectedMs);
    document.getElementById('expected-clock-out').textContent = formatTimeShort(expectedClockOut);
}

// Notification check (background only, no UI updates)
function startNotificationCheck() {
    if (window.notificationInterval) clearInterval(window.notificationInterval);

    window.notificationInterval = setInterval(function() {
        if (!clockInTime) {
            clearInterval(window.notificationInterval);
            return;
        }
        const elapsed = new Date() - clockInTime;
        const remaining = (expectedWorkHours * 60 * 60 * 1000) - elapsed;

        if (remaining < 15 * 60 * 1000 && remaining > 0 && !notificationShown) {
            showNotification();
            notificationShown = true;
        }
    }, 60000);
}

function showNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Time Tracker', {
            body: 'Your work day is almost complete! Remember to clock out.',
            icon: '/favicon.ico',
            tag: 'work-complete'
        });
    }
}

// Restore active session after app close
function restoreActiveSession() {
    const savedClockIn = localStorage.getItem('activeClockIn');
    const savedSessionName = localStorage.getItem('activeSessionName');
    const savedLocation = localStorage.getItem('activeLocation');
    const savedWorkHours = localStorage.getItem('expectedWorkHours');

    if (savedClockIn) {
        clockInTime = new Date(savedClockIn);
        currentSessionName = savedSessionName || 'Work';
        currentLocation = savedLocation || 'Office';
        expectedWorkHours = parseFloat(savedWorkHours) || 8;

        document.getElementById('status-dot').classList.add('active');
        document.getElementById('status-label').textContent = 'Active Session';
        document.getElementById('status-text').textContent = `Started at ${formatTime(clockInTime)}`;
        document.getElementById('clock-in-btn').disabled = true;
        document.getElementById('clock-out-btn').disabled = false;
        document.getElementById('check-btn').disabled = false;
        document.getElementById('work-hours-input').value = expectedWorkHours;
        document.getElementById('manual-time-section').style.display = 'none';

        updateExpectedClockOut();
        document.getElementById('clock-out-info').style.display = 'block';

        const select = document.getElementById('session-name-select');
        if (['Work', 'Meeting', 'Break'].includes(savedSessionName)) {
            select.value = savedSessionName;
        } else {
            select.value = 'Custom';
            document.getElementById('custom-session-name').style.display = 'block';
            document.getElementById('custom-session-name').value = savedSessionName;
        }

        setLocation(currentLocation);
        startNotificationCheck();
    } else {
        document.getElementById('manual-time-section').style.display = 'block';
        document.getElementById('clock-out-info').style.display = 'none';
    }
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    if (tabName === 'history') renderHistory();
    if (tabName === 'calendar') renderCalendar();
}

// History
function renderHistory() {
    const list = document.getElementById('session-list');
    document.getElementById('session-count').textContent = sessions.length;

    if (sessions.length > 0) {
        const avgIn = sessions.reduce((s, x) => s + x.clockIn.getHours() * 60 + x.clockIn.getMinutes(), 0) / sessions.length;
        const avgOut = sessions.reduce((s, x) => s + x.clockOut.getHours() * 60 + x.clockOut.getMinutes(), 0) / sessions.length;

        document.getElementById('avg-clock-in').textContent =
            `${Math.floor(avgIn / 60).toString().padStart(2, '0')}:${Math.round(avgIn % 60).toString().padStart(2, '0')}`;
        document.getElementById('avg-clock-out').textContent =
            `${Math.floor(avgOut / 60).toString().padStart(2, '0')}:${Math.round(avgOut % 60).toString().padStart(2, '0')}`;
    } else {
        document.getElementById('avg-clock-in').textContent = '--:--';
        document.getElementById('avg-clock-out').textContent = '--:--';
    }

    renderCharts();

    if (sessions.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No sessions recorded yet</div></div>';
        return;
    }

    list.innerHTML = sessions.slice().reverse().map((session, index) => `
        <div class="session-card">
            <div class="session-header">
                <div class="session-info">
                    <div class="session-name-badge">${session.name || 'Work'}</div>
                    <div class="session-location-badge ${(session.location || 'Office').toLowerCase()}">${session.location || 'Office'}</div>
                    <div class="session-date">${formatDate(session.clockIn)}</div>
                </div>
                <div class="duration-badge">${session.duration}</div>
            </div>
            <div class="time-row">
                <div class="time-item">
                    <div class="time-label">Clock In</div>
                    <div class="time-value">${formatTimeShort(session.clockIn)}</div>
                </div>
                <div class="time-separator">→</div>
                <div class="time-item">
                    <div class="time-label">Clock Out</div>
                    <div class="time-value">${formatTimeShort(session.clockOut)}</div>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteSession(${sessions.length - 1 - index})">Delete Session</button>
        </div>
    `).join('');
}

function renderCharts() {
    if (sessions.length === 0) return;

    const recent = sessions.slice(-14);
    const labels = recent.map(s => formatDate(s.clockIn));
    const inTimes = recent.map(s => s.clockIn.getHours() + s.clockIn.getMinutes() / 60);
    const outTimes = recent.map(s => s.clockOut.getHours() + s.clockOut.getMinutes() / 60);

    const allTimes = [...inTimes, ...outTimes];
    const minTime = Math.floor(Math.min(...allTimes)) - 1;
    const maxTime = Math.ceil(Math.max(...allTimes)) + 1;

    if (clockInChart) clockInChart.destroy();
    if (clockOutChart) clockOutChart.destroy();

    const sharedOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const h = Math.floor(context.parsed.y);
                        const m = Math.round((context.parsed.y - h) * 60);
                        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    }
                }
            }
        },
        scales: {
            y: {
                min: minTime,
                max: maxTime,
                ticks: {
                    stepSize: 0.5,
                    callback: function(value) {
                        const h = Math.floor(value);
                        const m = Math.round((value - h) * 60);
                        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    }
                },
                grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
                grid: { display: false },
                ticks: { maxRotation: 45, minRotation: 45 }
            }
        }
    };

    clockInChart = new Chart(document.getElementById('clockInChart').getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: inTimes,
                borderColor: '#1e3a5f',
                backgroundColor: 'rgba(30,58,95,0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#1e3a5f',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6
            }]
        },
        options: sharedOptions
    });

    clockOutChart = new Chart(document.getElementById('clockOutChart').getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: outTimes,
                borderColor: '#2c5282',
                backgroundColor: 'rgba(44,82,130,0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#2c5282',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6
            }]
        },
        options: sharedOptions
    });
}

function deleteSession(index) {
    if (confirm('Delete this session?')) {
        sessions.splice(index, 1);
        localStorage.setItem('sessions', JSON.stringify(sessions));
        renderHistory();
        renderCalendar();
    }
}

// Calendar
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    document.getElementById('calendar-month').textContent =
        currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        .map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        const daySessions = sessions.filter(s => {
            const d = new Date(s.clockIn);
            return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}` === dateString;
        });

        const isSelected = selectedDate === dateString;
        let locationBar = '';

        if (daySessions.length > 0) {
            const hasOffice = daySessions.some(s => s.location === 'Office');
            const hasHome = daySessions.some(s => s.location === 'Home');
            const barClass = hasOffice && hasHome ? 'mixed' : hasOffice ? 'office' : 'home';
            locationBar = `<div class="location-bar ${barClass}"></div>`;
        }

        html += `<div class="calendar-day ${daySessions.length > 0 ? 'has-session' : ''} ${isSelected ? 'selected' : ''}"
                 onclick="selectDate('${dateString}')">
                    <span>${day}</span>
                    ${locationBar}
                </div>`;
    }

    document.getElementById('calendar-grid').innerHTML = html;
    updateLocationStats();
    if (selectedDate) renderCalendarSessions();
}

function updateLocationStats() {
    document.getElementById('office-days').textContent = sessions.filter(s => s.location === 'Office').length;
    document.getElementById('home-days').textContent = sessions.filter(s => s.location === 'Home').length;
}

function selectDate(dateString) {
    selectedDate = dateString;
    renderCalendar();
}

function renderCalendarSessions() {
    const container = document.getElementById('calendar-sessions');

    const dateSessions = sessions.filter(s => {
        const d = new Date(s.clockIn);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}` === selectedDate;
    });

    if (dateSessions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No sessions on this day</div></div>';
        return;
    }

    const [y, m, d] = selectedDate.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

    container.innerHTML = `
        <h3 class="section-title" style="margin-top: 16px;">
            ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </h3>
        ${dateSessions.map(session => `
            <div class="session-card">
                <div class="session-header">
                    <div class="session-info">
                        <div class="session-name-badge">${session.name || 'Work'}</div>
                        <div class="session-location-badge ${(session.location || 'Office').toLowerCase()}">${session.location || 'Office'}</div>
                    </div>
                    <div class="duration-badge">${session.duration}</div>
                </div>
                <div class="time-row">
                    <div class="time-item">
                        <div class="time-label">Clock In</div>
                        <div class="time-value">${formatTimeShort(session.clockIn)}</div>
                    </div>
                    <div class="time-separator">→</div>
                    <div class="time-item">
                        <div class="time-label">Clock Out</div>
                        <div class="time-value">${formatTimeShort(session.clockOut)}</div>
                    </div>
                </div>
            </div>
        `).join('')}
    `;
}

function previousMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    renderCalendar();
}

// Export / Import / Clear
function exportData() {
    const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        sessions: sessions.map(s => ({
            clockIn: s.clockIn.toISOString(),
            clockOut: s.clockOut.toISOString(),
            duration: s.duration,
            name: s.name,
            location: s.location
        })),
        metadata: {
            totalSessions: sessions.length,
            officeDays: sessions.filter(s => s.location === 'Office').length,
            homeDays: sessions.filter(s => s.location === 'Home').length
        }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('Data exported successfully!');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.sessions || !Array.isArray(data.sessions)) throw new Error('Invalid data format');

            if (!confirm(`Import ${data.sessions.length} sessions?\n\nThis will ADD to your existing ${sessions.length} sessions.\n\nExport Date: ${new Date(data.exportDate).toLocaleDateString()}`)) {
                event.target.value = '';
                return;
            }

            const imported = data.sessions.map(s => ({
                clockIn: new Date(s.clockIn),
                clockOut: new Date(s.clockOut),
                duration: s.duration,
                name: s.name || 'Work',
                location: s.location || 'Office'
            }));

            sessions = [...sessions, ...imported].sort((a, b) => a.clockIn - b.clockIn);
            localStorage.setItem('sessions', JSON.stringify(sessions));
            renderHistory();
            renderCalendar();
            alert(`Successfully imported ${imported.length} sessions!`);
        } catch (error) {
            alert('Error importing data: ' + error.message);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (!confirm('WARNING: This will permanently delete all your sessions!\n\nAre you absolutely sure?\n\nTip: Export your data first to create a backup.')) return;
    if (!confirm('Last chance! This cannot be undone.\n\nDelete all sessions?')) return;

    sessions = [];
    ['sessions', 'activeClockIn', 'activeSessionName', 'activeLocation', 'expectedWorkHours'].forEach(k => localStorage.removeItem(k));

    if (clockInTime) {
        clockInTime = null;
        if (window.notificationInterval) clearInterval(window.notificationInterval);
        document.getElementById('status-dot').classList.remove('active');
        document.getElementById('status-label').textContent = 'No Active Session';
        document.getElementById('status-text').textContent = 'Ready to clock in';
        document.getElementById('elapsed-time').textContent = '--:--:--';
        document.getElementById('remaining-time').textContent = '--:--:--';
        document.getElementById('clock-in-btn').disabled = false;
        document.getElementById('clock-out-btn').disabled = true;
        document.getElementById('check-btn').disabled = true;
        document.getElementById('clock-out-info').style.display = 'none';
        document.getElementById('manual-time-section').style.display = 'block';
    }

    renderHistory();
    renderCalendar();
    alert('All data has been cleared.');
}

// Initialize
renderHistory();
renderCalendar();
restoreActiveSession();
