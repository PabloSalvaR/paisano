# Paisano · Hacé tu tierra.

Juego de estrategia por turnos para jugar con amigos en el navegador, en 3D. Se construye, se comercia con recursos y gana quien arma mejor su tierra.

**Demo:** https://paisano-three.vercel.app

## Estado

Prueba de concepto en desarrollo. Ya se puede jugar una partida completa en el navegador: sola contra tres bots, con cuatro personas en la misma pantalla, o en una sala online por link (por ahora solo en desarrollo local, hasta conectar la base de datos gratuita).

- Tablero hexagonal de 19 casillas generado al azar, con puertos, fichas de número y piezas de ejemplo.
- Cinco terrenos con recursos de sabor local: **Bosque** (madera), **Llano** (vaca), **Campo** (maíz), **Barro** (ladrillo) y **Cantera** (piedra), más el **Desierto**.
- Tres iluminaciones: día, atardecer y noche.
- Motor de reglas propio, con tests: colocación inicial, dados y producción, construcción, ladrón, descarte y robo, comercio con el banco y puertos, victoria.
- Bots que juegan con las mismas acciones legales que una persona, y salas por link con vista filtrada por jugador.

## Cómo correrlo

Hace falta [Node.js](https://nodejs.org) (LTS).

```bash
cd client
npm install
npm run dev
```

Abrí http://localhost:3000.

Otros comandos, siempre desde `client/`: `npm test` (tests), `npm run build` (compilar) y `npm run lint` (revisar el código).

## Tecnología

- [Next.js](https://nextjs.org) + React + TypeScript
- [three.js](https://threejs.org) (versión r128, fija a propósito) para el tablero 3D
- Desplegado en [Vercel](https://vercel.com)

## Estructura

```
client/   Aplicación web (Next.js) y tablero 3D
```

## Próximos pasos

1. Conectar la base de datos gratuita (Upstash) para jugar online en la demo.
2. Cartas de desarrollo y comercio entre jugadores.
3. Variantes y módulos de reglas configurables.
