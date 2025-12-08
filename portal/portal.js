// Auth Logic
function login(username, password) {
  const student = MOCK_DATA.students.find(s => s.id === username && s.password === password);
  if (student) {
    localStorage.setItem('currentUser', JSON.stringify({ ...student, role: 'student' }));
    window.location.href = 'student.html';
    return;
  }

  const teacher = MOCK_DATA.teachers.find(t => t.id === username && t.password === password);
  if (teacher) {
    localStorage.setItem('currentUser', JSON.stringify({ ...teacher, role: 'teacher' }));
    window.location.href = 'teacher.html';
    return;
  }

  alert('Usuario o contraseña incorrectos');
}

function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

function checkAuth(requiredRole) {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    alert('Acceso no autorizado');
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// Render Helpers
// Render Helpers
function renderStudentDashboard(user) {
  document.getElementById('studentName').textContent = user.name;
  document.getElementById('planName').textContent = user.plan;
  document.getElementById('classesRemaining').textContent = user.classesRemaining;

  // Global Status based on overdue payments
  const hasOverdue = user.paymentSchedule && user.paymentSchedule.some(p => p.status === 'Overdue');
  const statusEl = document.getElementById('globalStatus');
  if (statusEl) {
    statusEl.textContent = hasOverdue ? 'Pagos Pendientes' : 'Al Día';
    statusEl.className = hasOverdue ? 'status-text-danger' : 'status-text-success';
    statusEl.style.color = hasOverdue ? '#e74c3c' : '#2ecc71';
    statusEl.style.fontWeight = 'bold';
  }

  // Next Class Card
  const nextClassCard = document.getElementById('nextClassCard');
  if (user.nextClass) {
    const isConfirmed = user.nextClass.status === 'confirmed';
    nextClassCard.innerHTML = `
            <div class="stat-label">Próxima Clase</div>
            <div class="stat-value" style="font-size: 1.1rem; color: var(--accent); margin-bottom: 0.5rem;">
                ${user.nextClass.day} ${user.nextClass.time}<br>
                <span style="font-size: 0.9rem; color: var(--text-color);">${user.nextClass.name}</span>
            </div>
            ${isConfirmed
        ? `<button class="btn" style="background: #2ecc71; color: white; cursor: default;">¡Confirmado! ✅</button>`
        : `<button onclick="confirmAttendance('${user.nextClass.id}')" class="btn btn-primary" style="padding: 0.5rem 1rem;">Confirmar Asistencia</button>`
      }
        `;
  } else {
    nextClassCard.innerHTML = `
            <div class="stat-label">Próxima Clase</div>
            <div class="stat-value" style="font-size: 1rem; color: var(--text-muted);">Sin clases próximas</div>
        `;
  }

  // Payments Table
  if (user.paymentSchedule) {
    const paymentsHtml = user.paymentSchedule.map(p => {
      let statusClass = 'status-pending';
      if (p.status === 'Paid') statusClass = 'status-paid';
      if (p.status === 'Overdue') statusClass = 'status-overdue'; // You might need to add this CSS class

      return `
            <tr>
              <td>${p.month}</td>
              <td>$${p.amount.toLocaleString()}</td>
              <td>${p.date}</td>
              <td><span class="status-badge ${statusClass}" 
                 style="${p.status === 'Overdue' ? 'background: #ffebee; color: #c62828;' : ''}">${p.status === 'Paid' ? 'Pagado' : p.status}</span></td>
            </tr>
            `;
    }).join('');
    document.getElementById('paymentsTable').innerHTML = paymentsHtml;
  }

  // Weekly Schedule
  const scheduleHtml = user.schedule.map(s => `
    <div class="card" style="margin-bottom: 1rem; padding: 1rem;">
      <strong>${s.day} ${s.time}</strong>
      <p style="margin:0">${s.class} con ${s.instructor}</p>
    </div>
  `).join('');
  document.getElementById('scheduleList').innerHTML = scheduleHtml;
}

function confirmAttendance(classId) {
  // In a real app, this would be an API call
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user && user.nextClass && user.nextClass.id === classId) {
    user.nextClass.status = 'confirmed';
    localStorage.setItem('currentUser', JSON.stringify(user));

    // Refresh UI
    renderStudentDashboard(user);
    alert('¡Asistencia confirmada exitosamente!');
  }
}

function renderTeacherDashboard(user) {
  document.getElementById('teacherName').textContent = user.name;

  const studentsHtml = user.students.map(s => {
    const statusColor = s.paymentStatus === 'Paid' ? 'var(--success)' :
      (s.paymentStatus === 'Overdue' ? 'var(--danger, #e74c3c)' : 'var(--warning, #f1c40f)');
    return `
        <tr>
          <td>
            <div style="font-weight: bold;">${s.name}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${s.email}</div>
          </td>
          <td>${s.plan}</td>
          <td>
            <span class="status-badge" style="background-color: ${statusColor}20; color: ${statusColor};">
                ${s.paymentStatus === 'Overdue' ? 'Vencido' : (s.paymentStatus === 'Paid' ? 'Al día' : 'Pendiente')}
            </span>
          </td>
          <td><button class="btn btn-ghost" style="padding: 0.25rem 0.5rem; font-size: 0.8rem">Ver Ficha</button></td>
        </tr>
      `}).join('');
  document.getElementById('studentsTable').innerHTML = studentsHtml;

  const classesHtml = user.upcomingClasses.map(c => {
    const confirmedCount = c.attendees.filter(a => a.status === 'Confirmed').length;
    const attendeesList = c.attendees.map(a =>
      `<div style="font-size: 0.85rem; margin-top: 0.2rem;">
               ${a.status === 'Confirmed' ? '✅' : '⏳'} ${a.name}
             </div>`
    ).join('');

    return `
        <div class="stat-card" style="align-items: flex-start;">
          <div style="display: flex; justify-content: space-between; width: 100%;">
            <h3>${c.day} ${c.time}</h3>
            <span style="font-size: 0.9rem; background: var(--bg-body); padding: 0.2rem 0.6rem; border-radius: 1rem;">
                ${confirmedCount}/${c.totalSlots || '-'} Confirmados
            </span>
          </div>
          <p style="color: var(--primary); font-weight: bold; margin-bottom: 0.5rem;">${c.class}</p>
          
          <div style="background: rgba(0,0,0,0.03); width: 100%; padding: 0.5rem; border-radius: var(--radius-sm);">
            <strong style="font-size: 0.9rem;">Asistentes:</strong>
            ${attendeesList}
          </div>
        </div>
      `}).join('');
  document.getElementById('upcomingClasses').innerHTML = classesHtml;
}
