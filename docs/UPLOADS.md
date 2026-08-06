# Uploads and 3D Files

Supported formats may include:

- STL
- 3MF
- STEP and STP
- OBJ
- G-code
- PNG, JPG, WEBP, GIF
- PDF, TXT, CSV, ZIP

Files are stored in persistent Docker storage and served through authenticated routes.

## Security

- Enforce file size limits.
- Allow-list supported extensions.
- Restrict access by customer and permission.
- Do not commit uploads to GitHub.
- Delete stored files when authorized CRM records are deleted.

## Preview

Supported 3D files may provide rotate, zoom, pan, dimensions, and triangle count.
