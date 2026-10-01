# Marbella Club Cevichería — Backend propio (RAG + BD)

Backend de ingeniería propia (Node.js/Express) para el proyecto de tesis
"Asistente conversacional basado en LLM para la gestión de pedidos en
restaurantes del distrito de La Joya, Arequipa". Este es el componente que
da profundidad de Ingeniería de Sistemas al proyecto, más allá de lo que
Voiceflow resuelve por sí solo (por eso lo agregamos, según la observación
de la asesora).

## Qué hace

1. **Módulo RAG** (`src/ragEngine.js`): genera embeddings semánticos del
   menú real de Marbella Club con `@xenova/transformers`
   (modelo `all-MiniLM-L6-v2`, corre localmente, sin API externa) y permite
   búsquedas en lenguaje natural ("algo picante de mariscos" → encuentra el
   ceviche en crema de rocoto).
2. **Base de datos SQLite** (`src/db.js`): persiste pedidos reales
   (cliente, ítems, cantidades, estado) — reemplaza cualquier variable
   temporal de Voiceflow. Usa `node:sqlite`, el módulo SQLite nativo de
   Node.js (desde la v22.5), así que no requiere compilar nada ni instalar
   Visual Studio Build Tools en Windows.
3. **Servidor Express** (`src/server.js`): expone los endpoints que
   Voiceflow llama (vía un API step / integración HTTP) para resolver
   consultas de menú y registrar pedidos.

## Estructura

```
marbella-backend/
├── package.json
├── README.md
└── src/
    ├── server.js         # servidor Express (arranque + endpoints)
    ├── ragEngine.js       # motor RAG (embeddings + búsqueda semántica)
    ├── db.js               # capa SQLite (pedidos)
    ├── initDb.js           # script para crear el esquema de BD
    ├── testRag.js          # prueba de precisión del RAG con el menú real
    └── data/
        ├── menu.json                 # menú real de Marbella Club (transcrito de fotos)
        ├── menu.embeddings.json      # cache de embeddings (se genera solo)
        └── pedidos.db                # base de datos SQLite (se genera solo)
```

## Instalación

```bash
npm install
```

## Uso

```bash
# 1. Crear el esquema de la base de datos (opcional, el servidor lo hace solo)
npm run init:db

# 2. Correr la prueba de precisión del RAG con el menú real
npm run test:rag

# 3. Levantar el servidor
npm start
```

El servidor queda escuchando en `http://localhost:3000` (configurable con
la variable de entorno `PORT`).

## Endpoints

### `GET /health`
Verifica que el servicio está arriba.

### `POST /rag/query`
Búsqueda semántica sobre el menú real.
```json
{ "consulta": "algo picante de mariscos", "topK": 3 }
```

### `GET /menu`
Devuelve el menú completo tal como está en `menu.json`.

### `POST /pedidos`
Crea un pedido nuevo.
```json
{ "clienteWhatsapp": "+51987654321", "clienteNombre": "Juan Pérez" }
```

### `POST /pedidos/:id/items`
Agrega un ítem a un pedido existente.
```json
{ "itemId": "cev003", "nombre": "Ceviche Mixto", "cantidad": 2, "precioUnitario": 25.00 }
```

### `GET /pedidos/:id`
Devuelve el pedido con sus ítems y el total calculado.

### `PUT /pedidos/:id/estado`
Actualiza el estado del pedido (`en_proceso`, `confirmado`, `cancelado`,
`entregado`).
```json
{ "estado": "confirmado" }
```

### `GET /pedidos?estado=en_proceso`
Lista pedidos, opcionalmente filtrados por estado.

## Resultado de la prueba de precisión (RAG)

Con el menú real (63 ítems) y 12 consultas en lenguaje natural: **11/12
(91.7%)** de aciertos en el top-1 resultado. El único caso fallido
("quiero un ceviche mixto grande" → confundido con "Cevichop Mixto") es
un caso legítimo de ambigüedad semántica entre dos nombres del menú muy
similares textualmente, documentado como material de discusión (ver
salida de `npm run test:rag`).

## Pendientes antes de conectar con Voiceflow/Twilio

1. **Confirmar 3 precios poco legibles** en las fotos originales del menú
   (marcados con `nota_verificacion` en `menu.json`): Ceviche Marbella
   (mediano), Ceviche Guapo Sabroso (sin precio), y el dúo Ceviche de
   Pescado + Arroz con Mariscos.
2. **Desplegar este backend en un host público** (Render, Railway, Fly.io,
   etc. — cualquiera con capa gratuita sirve para la fase de pruebas) para
   que Voiceflow pueda llamarlo por HTTPS.
3. **Configurar el API step en Voiceflow** para que llame a `/rag/query`
   cuando el cliente pregunta por platos, y a `/pedidos` y
   `/pedidos/:id/items` cuando confirma su pedido.
4. **Conseguir el número de WhatsApp Business vía Twilio** (paso
   administrativo, pendiente de definir si lo gestiona Fran o el dueño del
   restaurante).
