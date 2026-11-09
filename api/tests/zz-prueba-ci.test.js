// PRUEBA TEMPORAL: esta prueba falla a propósito para comprobar que Railway NO publica cambios con pruebas rojas.
// Se borra en el cambio siguiente.
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('prueba temporal que falla a propósito (verificación de Wait for CI)', () => { assert.fail('Falla a propósito: si Railway espera a las pruebas, este cambio NO debe publicarse.'); });
