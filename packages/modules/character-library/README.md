# character-library · módulo LEGO reutilizable

Guarda **una sola vez** cada modelo 3D (GLB) de los seis personajes —Lumi, Bombo, Musgo, Nimbo, Nexo masculino (Janus) y Nexo femenino (Melanie)— y lo ofrece a todas las pantallas de Janus.

- `admit()`: valida con el inspector que inyecta el anfitrión (**3D Forge** en Janus; falla cerrado), guarda el GLB por huella SHA-256 con su recibo y lo deja como «pendiente de revisión visual».
- `review()`: decisión visual del Founder (`approved` o `rejected`).
- `overview()` (Founder) y `kidOverview()` (solo modelos aprobados, para la dashboard de Kendra).
- `bytes()`: devuelve el GLB verificando su huella.
- `adoptStaged()`: incorpora los GLB que ya dejó el comando `npm run forge:prepare` en la misma carpeta privada.

**Niveles.** `full` = esqueleto, huesos y animaciones del contrato; `partial` = malla válida pero sin rig (lo normal en Rodin/Hyper3D): se muestra quieta, con aviso.

La carpeta privada (por defecto `~/.janus/private/3d-forge`) nunca está dentro del repositorio público. No hay red, secretos ni entrenamiento.
