declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

/** Side-effect CSS imports (e.g. katex/dist/katex.min.css, ./styles/math.css). */
declare module '*.css';
