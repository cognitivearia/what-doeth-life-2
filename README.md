# Caleidoscopio

Pieza para dibujar con simetría de espejo. El trazo nuevo queda adelante y luego se hunde a un plano de atrás, más lento y más blando. El color recorre una rueda amplia a lo largo del trazo.

## Abrir

Doble clic en `abrir.bat`.

O, en una terminal dentro de esta carpeta:

```
py -3 -m http.server 5173
```

Luego abre http://127.0.0.1:5173

No abras `index.html` con doble clic. El navegador bloquea esta página si se abre como archivo suelto.

## Qué puedes hacer

- Dibujar con el mouse o el dedo. El color cambia solo según cuánto avance el trazo.
- Mover el mouse sin dibujar: los dos planos se desplazan a distinta velocidad.
- Cambiar los sectores con + y − de «espejos», con `[` y `]`, o con la rueda. Empieza en 6.
- Cambiar el pincel antes de dibujar, con + y − de «pincel», con las flechas arriba y abajo, o con Shift y la rueda. Va de 4 a 72.
- Borrar: el dibujo se apaga despacio. También con Supr o Retroceso.
- Guardar: descarga un PNG de la imagen, sin los botones. También con Ctrl+S.

Al soltar, el trazo pasa al fondo. Al cambiar los sectores, lo dibujado se vuelve a plegar.

## Parámetros

Están al inicio de `js/main.js`. Cambia el número, guarda y recarga.

- `sectores`: espejos al abrir. En la página se puede ir de 2 a 16.
- `grosor`: tamaño del pincel al abrir, en píxeles de la pantalla. En la página se puede cambiar.
- `plomo`: grosor de las líneas entre espejos.
- `marco`: grosor del borde del círculo.
- `brillo`: fuerza del centro del trazo. 1 es el máximo.
- `giro`: velocidad de la rotación del plano de adelante. 0 la deja quieta.
- `giroFondo`: cuánto gira el plano de atrás respecto al de adelante. 0.32 es un tercio.
- `profundidad`: cuánto se mueve el plano de adelante con el mouse. El de atrás se mueve menos.
- `hundir`: segundos que el trazo tarda en pasar atrás al soltar.
- `fondo`: segundos que el plano de atrás tarda en apagarse, para dejar sitio.
- `desvanecer`: segundos que tarda en apagarse al borrar.
- `recorrido`: grados de color por cada píxel del trazo. Con 0.8, un trazo largo da la vuelta a la rueda.
- `bloom`: fuerza del resplandor alrededor de la luz. 0 lo apaga.
- `eter`: qué tan lejos se abre esa luz, en píxeles.
- `fractal`: presencia de los fractales fuera del círculo. Usan los colores del trazo.

## Cómo está hecho

Hay dos lienzos ocultos: el de adelante y el de atrás. Three.js los muestra a pantalla completa. Un shader —un programa que decide el color de cada pixel— dobla el ángulo alrededor del centro, como espejos, y fuera del círculo dibuja una serie de fractales. Otro paso les suma un resplandor. Three.js está en `vendor/` y usa licencia MIT.
