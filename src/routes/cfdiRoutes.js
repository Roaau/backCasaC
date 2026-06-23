import { Router } from "express";
import { getCfdis, timbrarCfdi, cancelarCfdi, getXmlCfdi, enviarCorreoCfdi } from "../controllers/cfdiController.js";

const router = Router();

router.get("/",                       getCfdis);
router.post("/timbrar/:cfdiId",       timbrarCfdi);
router.post("/cancelar/:cfdiId",      cancelarCfdi);
router.get("/:cfdiId/xml",            getXmlCfdi);
router.post("/:cfdiId/enviar-correo", enviarCorreoCfdi);

export default router;
