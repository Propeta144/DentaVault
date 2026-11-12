import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('patient form restores relationship and shows the custom field only for Other', async () => {
  // Hiwalay sa running dev server: hindi dapat mapalitan ng test ang
  // optimized dependency cache nito (504 Outdated Optimize Dep sa 3D).
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'dentavault-render-test-'))
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    cacheDir,
    server: { middlewareMode: true }, appType: 'custom',
  })
  try {
    const { default: Form } = await server.ssrLoadModule('/src/components/patients/PatientForm.jsx')
    const { patientInfoToForm } = await server.ssrLoadModule('/src/constants/patientInfo.js')
    const render = (patient) => renderToStaticMarkup(createElement(Form, {
      initialValues: patientInfoToForm(patient), onSubmit: () => {},
    }))
    const normal = render({ emergency_contact_relationship: 'Parent' })
    assert.ok(normal.includes('Select relationship'))
    assert.ok(normal.includes('value="Parent" selected'))
    assert.equal(normal.includes('Include the relationship'), false)
    assert.equal(normal.includes('Specify Relationship'), false)
    const other = render({ emergency_contact_relationship: 'Other', emergency_contact_relationship_other: 'Partner' })
    assert.ok(other.includes('Specify Relationship'))
    assert.ok(other.includes('value="Partner"'))
    assert.ok(other.includes('aria-required="true"'))
    const legacy = render({})
    assert.ok(legacy.includes('value="" selected'))
  } finally {
    await server.close()
    if (path.resolve(cacheDir).startsWith(path.resolve(tmpdir()) + path.sep)) {
      await rm(cacheDir, { recursive: true, force: true })
    }
  }
})
