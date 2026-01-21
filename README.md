# Registros — Control de Horas

Proyecto minimal con Next.js que contiene el mockup base para controlar horas extras, días familiares y más.

Comandos:

```bash
npm install
npm run dev
```

Abre http://localhost:3000

Export / Import CSV
- Usa el botón "Exportar CSV" para descargar tus registros.
- Usa "Importar CSV" para subir un archivo con columnas: `date`, `hours`, `type`, `note`.

Backup remoto (local)
- Hay un endpoint en `/api/backup` que acepta `GET` y `POST`.
- Para protegerlo, define `BACKUP_KEY` en tu `.env.local`. En desarrollo por defecto la key es `dev-key`.
- Para guardar en servidor pulsa "Backup servidor" y provee la key, para restaurar pulsa "Restaurar servidor".

Notas:
- La aplicación ahora usa una base de datos local SQLite con Prisma. Para inicializar la DB ejecuta:

```bash
npx prisma generate
npx prisma db push
```

- Los datos se guardan en `prisma/dev.db` (archivo SQLite). El backup en servidor escribe en `data/backup.json` en el servidor local.
