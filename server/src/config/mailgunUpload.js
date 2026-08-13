import multer from 'multer'

// Memory storage: walang isusulat sa disk hangga't hindi nagdedesisyon
// yung webhook controller (pagkatapos ng signature verification AT patient
// matching) na worth keeping talaga yung attachment. Sa mga rejected/
// unmatched/duplicate requests, hahayaan na lang mag-garbage-collect yung
// mga buffers — walang temp files na kailangang linisin sa failure paths.
//
// Walang fileFilter dito, di kagaya ng manual-upload multer ng
// config/upload.js: isang inbound email lang, pwede na siyang magdala ng
// ilang attachments (X-ray tapos, sabihin nating, email signature logo),
// at yung fileFilter ng multer, ia-abort niya yung BUONG request sa unang
// file na bumagsak sa filter. Hindi dapat masira yung magagandang
// attachment dahil lang sa isang masama — sa webhook controller na lang
// nangyayari yung mime-type filtering, per-attachment, kung saan puwede
// lang basta i-skip yung rejected file.
export const uploadMailgunAttachments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
}).any()
