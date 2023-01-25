tsc -p tsconfig.json && tsc -p tsconfig.cjs.json

cat >./dist/package.json <<!EOF
{
    "type": "module"
}
!EOF

cat >./dist/cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF