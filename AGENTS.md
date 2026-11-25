# VEX Academy - Protocolo de desarrollo

## Arquitectura existente
- React 19, TypeScript, Vite y Supabase.
- Conservar el framework y reutilizar componentes.
- No reconstruir el proyecto desde cero.

## Orquestacion multiagente
El agente principal Sonnet dirige, planifica,
distribuye tareas y valida resultados.

Delegar segun la especialidad:

- assistant: tareas simples, comandos y exploracion.
- frontend: diseno, interfaces y experiencia de usuario.
- developer: implementacion y desarrollo backend.
- reviewer: auditoria, accesibilidad y pruebas.
- reasoning: problemas tecnicos complejos.
- architect: arquitectura critica, seguridad y migraciones.

## Optimizacion de costos
- Priorizar los subagentes de NVIDIA.
- Reservar Sonnet para direccion y supervision.
- Solicitar autorizacion antes de utilizar Opus.
- Evitar lecturas repetitivas del repositorio.
- No repetir tareas completadas.
- No delegar recursivamente.
- No sustituir modelos fallidos sin autorizacion.

## Uso de skills
- Cargar solo las skills pertinentes.
- Investigar nuevas skills con find-skills.
- Verificar procedencia, licencia y compatibilidad.
- No instalar dependencias sin autorizacion.

## Proteccion del proyecto
- Trabajar en una rama independiente de main.
- Modificar exclusivamente los archivos necesarios.
- Conservar las funcionalidades existentes.
- No exponer credenciales ni secretos.
- No ejecutar migraciones en produccion.
- No realizar commits, push ni despliegues
  sin autorizacion.
- Verificar los cambios antes de finalizar.

## Control de calidad
- Ejecutar pruebas compatibles con el entorno.
- Delegar la revision a reviewer.
- Informar errores, limitaciones y archivos modificados.
- Responder siempre en espanol.
