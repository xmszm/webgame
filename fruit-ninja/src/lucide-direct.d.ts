declare module 'lucide/dist/esm/icons/*.js' {
  type IconNode = readonly [
    string,
    Readonly<Record<string, string | number>>,
    children?: readonly IconNode[],
  ];
  const icon: IconNode;
  export default icon;
}
