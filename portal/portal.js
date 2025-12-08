// Data Persistence
function initData() {
  if (!localStorage.getItem('portalData')) {
    localStorage.setItem('portalData', JSON.stringify(MOCK_DATA));
  }
}

function getData() {
  // Ensure data exists
  initData();
  return JSON.parse(localStorage.getItem('portalData'));
}

function saveData(data) {
  localStorage.setItem('portalData', JSON.stringify(data));
}

// Auth Logic
// Update login to use localStorage data instead of static MOCK_DATA
function login(username, password) {
  const data = getData();
  const student = data.students.find(s => s.id === username && s.password === password);

  if (student) {
    // Only store minimal session info, but for this mock we store the whole object + role
    // We should probably re-fetch current data on dashboard load to be safe
    localStorage.setItem('currentUser', JSON.stringify({ ...student, role: 'student' }));
    window.location.href = 'student.html';
    return;
  }

  const teacher = data.teachers.find(t => t.id === username && t.password === password);
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

// Teachers Dashboard Logic
let currentFilter = 'active';

function filterStudents(status) {
  currentFilter = status;
  // Update Buttons UI
  document.getElementById('btnShowActive').className = status === 'active' ? 'btn btn-sm active' : 'btn btn-sm btn-ghost';
  document.getElementById('btnShowArchived').className = status === 'archived' ? 'btn btn-sm active' : 'btn btn-sm btn-ghost';

  // Re-render
  const user = JSON.parse(localStorage.getItem('currentUser'));
  renderTeacherDashboard(user);
}

function openStudentModal(studentId = null) {
  const modal = document.getElementById('studentModal');
  const form = document.getElementById('studentForm');

  if (studentId) {
    document.getElementById('modalTitle').textContent = 'Editar Alumna';
    const data = getData();
    // Find student in the global list first (teachers have a subset usually, but let's look in global)
    // Actually, in this mock structure, teacher.students is a separate array from global.students which is messy.
    // For this CRUD to work properly, we should treat global 'students' as the source of truth
    // and 'teacher.students' as just a derived view or reference.
    // To simplify: we will edit the global student list, and also update the teacher's list if present.

    // Find student in teacher's list for now since that's what we render
    const teacher = JSON.parse(localStorage.getItem('currentUser'));
    const student = teacher.students.find(s => s.id === studentId);

    if (student) {
      document.getElementById('studentId').value = student.id;
      document.getElementById('editName').value = student.name;
      document.getElementById('editEmail').value = student.email || student.id; // Use ID as email fallback
      document.getElementById('editPlan').value = student.plan;
      document.getElementById('editPassword').value = '';
    }
  } else {
    document.getElementById('modalTitle').textContent = 'Nueva Alumna';
    form.reset();
    document.getElementById('studentId').value = '';
  }

  modal.style.display = 'flex';
}

function closeStudentModal() {
  document.getElementById('studentModal').style.display = 'none';
}

function handleStudentSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('studentId').value;
  const name = document.getElementById('editName').value;
  const email = document.getElementById('editEmail').value;
  const plan = document.getElementById('editPlan').value;
  const password = document.getElementById('editPassword').value;

  const data = getData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Update Global Data
  let studentObj;

  if (id) {
    // Edit existing
    // 1. Update in global students list
    studentObj = data.students.find(s => s.id === id);
    if (!studentObj) {
      // Create if missing (edge case)
      studentObj = { id: id, schedule: [], paymentSchedule: [] };
      data.students.push(studentObj);
    }

    studentObj.name = name;
    studentObj.plan = plan;
    // Update ID/Email if changed? Changing ID is tricky for relations, let's assume Email is just a display field for now unless it's the ID.
    // In this mock, ID = Email often.
    if (password) studentObj.password = password;

    // 2. Update in teacher's list
    // We need to find the teacher in global data to save permanently
    const globalTeacher = data.teachers.find(t => t.id === currentUser.id);
    const teacherStudent = globalTeacher.students.find(s => s.id === id);
    if (teacherStudent) {
      teacherStudent.name = name;
      teacherStudent.plan = plan;
      teacherStudent.email = email;
    }

  } else {
    // Create New
    const newId = email; // Simple ID generation

    // 1. Add to global students
    const newStudent = {
      id: newId,
      password: password || '123',
      name: name,
      plan: plan,
      email: email,
      classesRemaining: 0,
      paymentSchedule: [],
      schedule: []
    };
    data.students.push(newStudent);

    // 2. Add to teacher's list
    const globalTeacher = data.teachers.find(t => t.id === currentUser.id);
    globalTeacher.students.push({
      id: newId,
      name: name,
      plan: plan,
      email: email,
      paymentStatus: 'Pending',
      archived: false
    });
  }

  saveData(data);

  // Refresh UI
  // We need to reload the current user from the updated global data
  const updatedTeacher = data.teachers.find(t => t.id === currentUser.id);
  localStorage.setItem('currentUser', JSON.stringify({ ...updatedTeacher, role: 'teacher' }));

  renderTeacherDashboard(updatedTeacher);
  closeStudentModal();
}

function toggleArchiveStudent(id) {
  if (!confirm('¿Estás seguro de realizar esta acción?')) return;

  const data = getData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const globalTeacher = data.teachers.find(t => t.id === currentUser.id);
  const student = globalTeacher.students.find(s => s.id === id);

  if (student) {
    student.archived = !student.archived;
    saveData(data);

    // Refresh
    const updatedTeacher = data.teachers.find(t => t.id === currentUser.id);
    localStorage.setItem('currentUser', JSON.stringify({ ...updatedTeacher, role: 'teacher' }));
    renderTeacherDashboard(updatedTeacher);
  }
}

function renderTeacherDashboard(user) {
  document.getElementById('teacherName').textContent = user.name;

  // Defaults
  if (!user.students) user.students = [];

  const filteredStudents = user.students.filter(s => {
    if (currentFilter === 'active') return !s.archived;
    if (currentFilter === 'archived') return s.archived;
    return true;
  });

  const studentsHtml = filteredStudents.map(s => {
    const statusColor = s.paymentStatus === 'Paid' ? 'var(--success)' :
      (s.paymentStatus === 'Overdue' ? 'var(--danger, #e74c3c)' : 'var(--warning, #f1c40f)');

    const archiveBtnText = s.archived ? 'Restaurar' : 'Archivar';
    const archiveBtnIcon = s.archived ? '♻️' : '📁';

    return `
        <tr>
          <td>
            <div style="font-weight: bold;">${s.name}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${s.email || s.id}</div>
          </td>
          <td>${s.plan}</td>
          <td>
            <span class="status-badge" style="background-color: ${statusColor}20; color: ${statusColor};">
                ${s.paymentStatus === 'Overdue' ? 'Vencido' : (s.paymentStatus === 'Paid' ? 'Al día' : 'Pendiente')}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-ghost" onclick="openStudentModal('${s.id}')">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="toggleArchiveStudent('${s.id}')" title="${archiveBtnText}">${archiveBtnIcon}</button>
            </div>
          </td>
        </tr>
      `}).join('');

  const tableBody = document.getElementById('studentsTable');
  if (tableBody) tableBody.innerHTML = studentsHtml;
  else console.error('Table body not found');

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

  const upcomingClassesContainer = document.getElementById('upcomingClasses');
  if (upcomingClassesContainer) upcomingClassesContainer.innerHTML = classesHtml;
}
