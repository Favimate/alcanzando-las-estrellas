const MOCK_DATA = {
  students: [
    {
      id: "student",
      password: "123",
      name: "Valentina Muñoz",
      plan: "Plan Mensual 8 Clases",
      classesRemaining: 5,
      nextClass: {
        id: "class_001",
        day: "Martes",
        date: "09/12/2025",
        time: "18:00",
        name: "Pole Sport Intermedio",
        instructor: "Ana",
        status: "pending" // pending, confirmed
      },
      paymentSchedule: [
        { month: "Noviembre 2025", amount: 45000, date: "02/11/2025", status: "Paid" },
        { month: "Diciembre 2025", amount: 45000, date: "30/11/2025", status: "Overdue" },
        { month: "Enero 2026", amount: 45000, date: "30/12/2025", status: "Pending" },
      ],
      schedule: [
        { day: "Martes", time: "18:00", class: "Pole Sport Intermedio", instructor: "Ana" },
        { day: "Jueves", time: "19:00", class: "Flexibilidad", instructor: "Carla" },
      ]
    },
    {
      id: "student2",
      password: "123",
      name: "Maria Perez",
      plan: "Plan Mensual 4 Clases",
      classesRemaining: 0,
      nextClass: null, // No active plan/class
      paymentSchedule: [
        { month: "Octubre 2025", amount: 35000, date: "05/10/2025", status: "Paid" },
        { month: "Noviembre 2025", amount: 35000, date: "05/11/2025", status: "Overdue" }
      ],
      schedule: [
        { day: "Lunes", time: "10:00", class: "Pole Básico", instructor: "Ana" }
      ]
    }
  ],
  teachers: [
    {
      id: "teacher",
      password: "123",
      name: "Ana Instructora",
      role: "Profesora Principal",
      // Students list helps teacher view all students status
      students: [
        { id: "student", name: "Valentina Muñoz", plan: "8 Clases", paymentStatus: "Overdue", email: "valentina@email.com" },
        { id: "student2", name: "Maria Perez", plan: "4 Clases", paymentStatus: "Overdue", email: "maria@email.com" },
        { id: "student3", name: "Camila Soto", plan: "12 Clases", paymentStatus: "Paid", email: "camila@email.com" }
      ],
      upcomingClasses: [
        {
          id: "class_001",
          day: "Hoy",
          time: "18:00",
          class: "Pole Sport Intermedio",
          totalSlots: 10,
          attendees: [
            { name: "Camila Soto", status: "Confirmed" },
            { name: "Valentina Muñoz", status: "Pending" }
          ]
        },
        {
          id: "class_002",
          day: "Mañana",
          time: "10:00",
          class: "Pole Coreográfico",
          totalSlots: 8,
          attendees: [
            { name: "Andrea R.", status: "Confirmed" }
          ]
        }
      ]
    }
  ]
};
