-- Base de datos: Academia Alcanzando las Estrellas
-- Ejecutar: wrangler d1 execute academia-db --file=schema.sql

CREATE TABLE IF NOT EXISTS alumnas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  plan INTEGER NOT NULL CHECK(plan IN (1, 2, 3)),
  monto INTEGER NOT NULL,
  fecha_ingreso DATE NOT NULL,
  activa INTEGER DEFAULT 1,
  notas TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alumna_id INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
  año INTEGER NOT NULL,
  fecha_pago DATE,
  estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pagado', 'pendiente')),
  monto INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alumna_id) REFERENCES alumnas(id),
  UNIQUE(alumna_id, mes, año)
);

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

INSERT OR IGNORE INTO config (clave, valor) VALUES ('dia_vencimiento', '5');
INSERT OR IGNORE INTO config (clave, valor) VALUES ('notificaciones_activas', '1');
