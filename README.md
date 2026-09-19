# Paisano · Hacé tu tierra.

Juego de estrategia por turnos para jugar con amigos en el navegador, en 3D. Se construye, se comercia con recursos y gana quien arma mejor su tierra.

**Demo:** https://paisano-three.vercel.app

## Estado

Prueba de concepto en desarrollo. Por ahora está el **tablero 3D** con su estilo visual; el motor de reglas y el multijugador vienen después.

- Tablero hexagonal de 19 casillas generado al azar, con puertos, fichas de número y piezas de ejemplo.
- Cinco terrenos con recursos de sabor local: **Bosque** (madera), **Llano** (vaca), **Campo** (maíz), **Barro** (ladrillo) y **Cantera** (piedra), más el **Desierto**.
- Tres iluminaciones: día, atardecer y noche.

## Cómo correrlo

Hace falta [Node.js](https://nodejs.org) (LTS).

```bash
cd client
npm install
npm run dev
```

Abrí http://localhost:3000.

Otros comandos, siempre desde `client/`: `npm run build` (compilar) y `npm run lint` (revisar el código).

## Tecnología

- [Next.js](https://nextjs.org) + React + TypeScript
- [three.js](https://threejs.org) (versión r128, fija a propósito) para el tablero 3D
- Desplegado en [Vercel](https://vercel.com)

## Estructura

```
client/   Aplicación web (Next.js) y tablero 3D
```

## Próximos pasos

1. Motor de reglas del juego base.
2. Multijugador por salas con link.
3. Variantes y módulos de reglas configurables.
