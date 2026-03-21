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

// Initialize custom input handler
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
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function formatTimeShort(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

function formatDurationShort(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Timer functions
function clockIn() {
    clockInTime = new Date();
    expectedWorkHours = parseFloat(document.getElementById('work-hours-input').value) || 8;
    notificationShown = false;

    // Save to localStorage immediately
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

    // Reset display
    document.getElementById('elapsed-time').textContent = '--:--:--';
    document.getElementById('remaining-time').textContent = '--:--:--';

    // Start notification check timer (runs in background, doesn't update UI)
    startNotificationCheck();
}

function clockOut() {
    if (!clockInTime) return;

    const clockOutTime = new Date();
    const duration = clockOutTime - clockInTime;
    const durationString = formatDuration(duration);

    sessions.push({
        clockIn: clockInTime,
        clockOut: clockOutTime,
        duration: durationString,
        name: currentSessionName,
        location: currentLocation
    });

    localStorage.setItem('sessions', JSON.stringify(sessions));
    // Clear active session from localStorage
    localStorage.removeItem('activeClockIn');
    localStorage.removeItem('activeSessionName');
    localStorage.removeItem('activeLocation');
    localStorage.removeItem('expectedWorkHours');

    clockInTime = null;
    notificationShown = false;
    
    if (window.notificationInterval) {
        clearInterval(window.notificationInterval);
    }

    document.getElementById('status-dot').classList.remove('active');
    document.getElementById('status-label').textContent = 'No Active Session';
    document.getElementById('status-text').textContent = 'Ready to clock in';
    document.getElementById('elapsed-time').textContent = '--:--:--';
    document.getElementById('remaining-time').textContent = '--:--:--';
    document.getElementById('clock-in-btn').disabled = false;
    document.getElementById('clock-out-btn').disabled = true;
    document.getElementById('check-btn').disabled = true;

    renderHistory();
    renderCalendar();
}

function checkDuration() {
    if (!clockInTime) return;

    const now = new Date();
    const elapsed = now - clockInTime;
    const expectedMs = expectedWorkHours * 60 * 60 * 1000;
    const remaining = expectedMs - elapsed;

    document.getElementById('elapsed-time').textContent = formatDurationShort(elapsed);
    
    if (remaining > 0) {
        document.getElementById('remaining-time').textContent = formatDurationShort(remaining);
    } else {
        document.getElementById('remaining-time').textContent = '00:00:00';
    }
}

function startNotificationCheck() {
    if (window.notificationInterval) {
        clearInterval(window.notificationInterval);
    }
    
    // Check every minute for notification (doesn't update UI)
    window.notificationInterval = setInterval(function() {
        if (!clockInTime) {
            clearInterval(window.notificationInterval);
            return;
        }

        const now = new Date();
        const elapsed = now - clockInTime;
        const expectedMs = expectedWorkHours * 60 * 60 * 1000;
        const remaining = expectedMs - elapsed;

        // Check if within 15 minutes of completion
        if (remaining < 15 * 60 * 1000 && remaining > 0 && !notificationShown) {
            showNotification();
            notificationShown = true;
        }
    }, 60000); // Check every minute
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

// Restore active session if app was closed
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

        // Restore UI state
        document.getElementById('status-dot').classList.add('active');
        document.getElementById('status-label').textContent = 'Active Session';
        document.getElementById('status-text').textContent = `Started at ${formatTime(clockInTime)}`;
        document.getElementById('clock-in-btn').disabled = true;
        document.getElementById('clock-out-btn').disabled = false;
        document.getElementById('check-btn').disabled = false;
        document.getElementById('work-hours-input').value = expectedWorkHours;

        // Restore session name in dropdown
        const select = document.getElementById('session-name-select');
        if (savedSessionName === 'Work' || savedSessionName === 'Meeting' || savedSessionName === 'Break') {
            select.value = savedSessionName;
        } else {
            select.value = 'Custom';
            document.getElementById('custom-session-name').style.display = 'block';
            document.getElementById('custom-session-name').value = savedSessionName;
        }

        // Restore location
        setLocation(currentLocation);

        // Start notification check (doesn't update UI)
        startNotificationCheck();
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

// History rendering
function renderHistory() {
    const list = document.getElementById('session-list');
    document.getElementById('session-count').textContent = sessions.length;

    // Calculate and display averages
    if (sessions.length > 0) {
        const totalClockInMinutes = sessions.reduce((sum, session) => {
            return sum + (session.clockIn.getHours() * 60 + session.clockIn.getMinutes());
        }, 0);
        const avgClockInMinutes = totalClockInMinutes / sessions.length;
        const avgClockInHours = Math.floor(avgClockInMinutes / 60);
        const avgClockInMins = Math.round(avgClockInMinutes % 60);
        document.getElementById('avg-clock-in').textContent =
            `${avgClockInHours.toString().padStart(2, '0')}:${avgClockInMins.toString().padStart(2, '0')}`;

        const totalClockOutMinutes = sessions.reduce((sum, session) => {
            return sum + (session.clockOut.getHours() * 60 + session.clockOut.getMinutes());
        }, 0);
        const avgClockOutMinutes = totalClockOutMinutes / sessions.length;
        const avgClockOutHours = Math.floor(avgClockOutMinutes / 60);
        const avgClockOutMins = Math.round(avgClockOutMinutes % 60);
        document.getElementById('avg-clock-out').textContent =
            `${avgClockOutHours.toString().padStart(2, '0')}:${avgClockOutMins.toString().padStart(2, '0')}`;
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

    const recentSessions = sessions.slice(-14);
    const labels = recentSessions.map(s => formatDate(s.clockIn));
    const clockInTimes = recentSessions.map(s => s.clockIn.getHours() + s.clockIn.getMinutes() / 60);
    const clockOutTimes = recentSessions.map(s => s.clockOut.getHours() + s.clockOut.getMinutes() / 60);

    // Calculate dynamic Y-axis range
    const allTimes = [...clockInTimes, ...clockOutTimes];
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
                        const hours = Math.floor(context.parsed.y);
                        const minutes = Math.round((context.parsed.y - hours) * 60);
                        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
                        const hours = Math.floor(value);
                        const minutes = Math.round((value - hours) * 60);
                        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    }
                },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
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
                data: clockInTimes,
                borderColor: '#1e3a5f',
                backgroundColor: 'rgba(30, 58, 95, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#1e3a5f',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
            }]
        },
        options: sharedOptions
    });

    clockOutChart = new Chart(document.getElementById('clockOutChart').getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: clockOutTimes,
                borderColor: '#2c5282',
                backgroundColor: 'rgba(44, 82, 130, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#2c5282',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
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

// Calendar rendering
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    document.getElementById('calendar-month').textContent =
        currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        .map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    let adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // Find sessions for this day
        const daySessions = sessions.filter(s => {
            const d = new Date(s.clockIn);
            const dStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
            return dStr === dateString;
        });

        const hasSessions = daySessions.length > 0;
        const isSelected = selectedDate === dateString;

        // Determine location indicator
        let locationBar = '';
        if (hasSessions) {
            const hasOffice = daySessions.some(s => s.location === 'Office');
            const hasHome = daySessions.some(s => s.location === 'Home');
            
            if (hasOffice && hasHome) {
                locationBar = '<div class="location-bar mixed"></div>';
            } else if (hasOffice) {
                locationBar = '<div class="location-bar office"></div>';
            } else if (hasHome) {
                locationBar = '<div class="location-bar home"></div>';
            }
        }

        html += `<div class="calendar-day ${hasSessions ? 'has-session' : ''} ${isSelected ? 'selected' : ''}" 
                 onclick="selectDate('${dateString}')">
                    <span>${day}</span>
                    ${locationBar}
                </div>`;
    }

    document.getElementById('calendar-grid').innerHTML = html;
    
    // Update office/home stats
    updateLocationStats();
    
    if (selectedDate) renderCalendarSessions();
}

function updateLocationStats() {
    const officeDays = sessions.filter(s => s.location === 'Office').length;
    const homeDays = sessions.filter(s => s.location === 'Home').length;
    
    document.getElementById('office-days').textContent = officeDays;
    document.getElementById('home-days').textContent = homeDays;
}

function selectDate(dateString) {
    selectedDate = dateString;
    renderCalendar();
}

function renderCalendarSessions() {
    const container = document.getElementById('calendar-sessions');

    const dateSessions = sessions.filter(s => {
        const d = new Date(s.clockIn);
        const dStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        return dStr === selectedDate;
    });

    if (dateSessions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No sessions on this day</div></div>';
        return;
    }

    const [yearStr, monthStr, dayStr] = selectedDate.split('-');
    const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));

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

// Data Export/Import Functions
function exportData() {
    const exportData = {
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

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
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
            const importData = JSON.parse(e.target.result);
            
            // Validate data structure
            if (!importData.sessions || !Array.isArray(importData.sessions)) {
                throw new Error('Invalid data format');
            }

            // Ask for confirmation
            const confirmMsg = `Import ${importData.sessions.length} sessions?\n\nThis will ADD to your existing ${sessions.length} sessions.\n\nExport Date: ${new Date(importData.exportDate).toLocaleDateString()}`;
            
            if (!confirm(confirmMsg)) {
                event.target.value = ''; // Reset file input
                return;
            }

            // Convert dates back to Date objects and merge with existing sessions
            const importedSessions = importData.sessions.map(s => ({
                clockIn: new Date(s.clockIn),
                clockOut: new Date(s.clockOut),
                duration: s.duration,
                name: s.name || 'Work',
                location: s.location || 'Office'
            }));

            // Merge and sort by date
            sessions = [...sessions, ...importedSessions].sort((a, b) => a.clockIn - b.clockIn);
            
            // Save to localStorage
            localStorage.setItem('sessions', JSON.stringify(sessions));
            
            // Refresh displays
            renderHistory();
            renderCalendar();
            
            alert(`Successfully imported ${importedSessions.length} sessions!`);
            
        } catch (error) {
            alert('Error importing data: ' + error.message + '\n\nPlease ensure you are importing a valid TimeTracker backup file.');
        }
        
        event.target.value = ''; // Reset file input
    };
    
    reader.readAsText(file);
}

function clearAllData() {
    const confirmMsg = 'WARNING: This will permanently delete all your sessions!\n\nAre you absolutely sure?\n\nTip: Export your data first to create a backup.';
    
    if (!confirm(confirmMsg)) return;
    
    // Double confirmation
    const doubleConfirm = confirm('Last chance! This cannot be undone.\n\nDelete all sessions?');
    
    if (!doubleConfirm) return;
    
    // Clear all data
    sessions = [];
    localStorage.removeItem('sessions');
    localStorage.removeItem('activeClockIn');
    localStorage.removeItem('activeSessionName');
    localStorage.removeItem('activeLocation');
    localStorage.removeItem('expectedWorkHours');
    
    // Reset UI
    if (clockInTime) {
        clockInTime = null;
        if (window.notificationInterval) {
            clearInterval(window.notificationInterval);
        }
        document.getElementById('status-dot').classList.remove('active');
        document.getElementById('status-label').textContent = 'No Active Session';
        document.getElementById('status-text').textContent = 'Ready to clock in';
        document.getElementById('elapsed-time').textContent = '--:--:--';
        document.getElementById('remaining-time').textContent = '--:--:--';
        document.getElementById('clock-in-btn').disabled = false;
        document.getElementById('clock-out-btn').disabled = true;
        document.getElementById('check-btn').disabled = true;
    }
    
    renderHistory();
    renderCalendar();
    
    alert('All data has been cleared.');
}

// Initialize
renderHistory();
renderCalendar();
restoreActiveSession();