import dotenv from "dotenv";
dotenv.config({ override: true });

import sequelize from "./src/config/database.js";
import CatSatFormaPago       from "./src/models/CatSatFormaPago.js";
import CatSatMetodoPago      from "./src/models/CatSatMetodoPago.js";
import CatSatUsoCfdi         from "./src/models/CatSatUsoCfdi.js";
import CatSatRegimenFiscal   from "./src/models/CatSatRegimenFiscal.js";
import CatSatUnidad          from "./src/models/CatSatUnidad.js";
import CatSatProductoServicio from "./src/models/CatSatProductoServicio.js";
import CatSatCp              from "./src/models/CatSatCp.js";
import CatSatColonia         from "./src/models/CatSatColonia.js";

// ─── FORMAS DE PAGO ───────────────────────────────────────────────────────────
const formasPago = [
  { clave: '01', descripcion: 'Efectivo' },
  { clave: '02', descripcion: 'Cheque nominativo' },
  { clave: '03', descripcion: 'Transferencia electrónica de fondos' },
  { clave: '04', descripcion: 'Tarjeta de crédito' },
  { clave: '05', descripcion: 'Monedero electrónico' },
  { clave: '06', descripcion: 'Dinero electrónico' },
  { clave: '08', descripcion: 'Vales de despensa' },
  { clave: '12', descripcion: 'Dación en pago' },
  { clave: '13', descripcion: 'Pago por subrogación' },
  { clave: '14', descripcion: 'Pago por consignación' },
  { clave: '15', descripcion: 'Condonación' },
  { clave: '17', descripcion: 'Compensación' },
  { clave: '23', descripcion: 'Novación' },
  { clave: '24', descripcion: 'Confusión' },
  { clave: '25', descripcion: 'Remisión de deuda' },
  { clave: '26', descripcion: 'Prescripción o caducidad' },
  { clave: '27', descripcion: 'A satisfacción del acreedor' },
  { clave: '28', descripcion: 'Tarjeta de débito' },
  { clave: '29', descripcion: 'Tarjeta de servicios' },
  { clave: '30', descripcion: 'Aplicación de anticipos' },
  { clave: '31', descripcion: 'Intermediario pagos' },
  { clave: '99', descripcion: 'Por definir' },
];

// ─── MÉTODOS DE PAGO ──────────────────────────────────────────────────────────
const metodosPago = [
  { clave: 'PUE', descripcion: 'Pago en una sola exhibición' },
  { clave: 'PPD', descripcion: 'Pago en parcialidades o diferido' },
];

// ─── USOS DE CFDI ─────────────────────────────────────────────────────────────
const usosCfdi = [
  { clave: 'G01', descripcion: 'Adquisición de mercancias',                                          aplica_fisica: true,  aplica_moral: true  },
  { clave: 'G02', descripcion: 'Devoluciones, descuentos o bonificaciones',                          aplica_fisica: true,  aplica_moral: true  },
  { clave: 'G03', descripcion: 'Gastos en general',                                                  aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I01', descripcion: 'Construcciones',                                                     aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I02', descripcion: 'Mobilario y equipo de oficina por inversiones',                      aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I03', descripcion: 'Equipo de transporte',                                               aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I04', descripcion: 'Equipo de computo y accesorios',                                     aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I05', descripcion: 'Dados, troqueles, moldes, matrices y herramental',                   aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I06', descripcion: 'Comunicaciones telefónicas',                                         aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I07', descripcion: 'Comunicaciones satelitales',                                         aplica_fisica: true,  aplica_moral: true  },
  { clave: 'I08', descripcion: 'Otra maquinaria y equipo',                                           aplica_fisica: true,  aplica_moral: true  },
  { clave: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios',                aplica_fisica: true,  aplica_moral: false },
  { clave: 'D02', descripcion: 'Gastos médicos por incapacidad o discapacidad',                     aplica_fisica: true,  aplica_moral: false },
  { clave: 'D03', descripcion: 'Gastos funerales',                                                   aplica_fisica: true,  aplica_moral: false },
  { clave: 'D04', descripcion: 'Donativos',                                                          aplica_fisica: true,  aplica_moral: false },
  { clave: 'D05', descripcion: 'Intereses reales efectivamente pagados por créditos hipotecarios',   aplica_fisica: true,  aplica_moral: false },
  { clave: 'D06', descripcion: 'Aportaciones voluntarias al SAR',                                   aplica_fisica: true,  aplica_moral: false },
  { clave: 'D07', descripcion: 'Primas por seguros de gastos médicos',                              aplica_fisica: true,  aplica_moral: false },
  { clave: 'D08', descripcion: 'Gastos de transportación escolar obligatoria',                      aplica_fisica: true,  aplica_moral: false },
  { clave: 'D09', descripcion: 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones', aplica_fisica: true, aplica_moral: false },
  { clave: 'D10', descripcion: 'Pagos por servicios educativos (colegiaturas)',                     aplica_fisica: true,  aplica_moral: false },
  { clave: 'S01', descripcion: 'Sin efectos fiscales',                                              aplica_fisica: true,  aplica_moral: true  },
  { clave: 'CP01', descripcion: 'Pagos',                                                            aplica_fisica: true,  aplica_moral: true  },
  { clave: 'CN01', descripcion: 'Nómina',                                                           aplica_fisica: true,  aplica_moral: false },
];

// ─── REGÍMENES FISCALES ───────────────────────────────────────────────────────
const regimenes = [
  { clave: '601', descripcion: 'General de Ley Personas Morales',                                                    aplica_fisica: false, aplica_moral: true  },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos',                                           aplica_fisica: false, aplica_moral: true  },
  { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',                               aplica_fisica: true,  aplica_moral: false },
  { clave: '606', descripcion: 'Arrendamiento',                                                                      aplica_fisica: true,  aplica_moral: false },
  { clave: '607', descripcion: 'Régimen de Enajenación o Adquisición de Bienes',                                    aplica_fisica: true,  aplica_moral: false },
  { clave: '608', descripcion: 'Demás ingresos',                                                                     aplica_fisica: true,  aplica_moral: false },
  { clave: '609', descripcion: 'Consolidación',                                                                      aplica_fisica: false, aplica_moral: true  },
  { clave: '610', descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México',              aplica_fisica: true,  aplica_moral: true  },
  { clave: '611', descripcion: 'Ingresos por Dividendos (socios y accionistas)',                                    aplica_fisica: true,  aplica_moral: false },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales',                   aplica_fisica: true,  aplica_moral: false },
  { clave: '614', descripcion: 'Ingresos por intereses',                                                            aplica_fisica: true,  aplica_moral: false },
  { clave: '615', descripcion: 'Régimen de los ingresos por obtención de premios',                                 aplica_fisica: true,  aplica_moral: false },
  { clave: '616', descripcion: 'Sin obligaciones fiscales',                                                         aplica_fisica: true,  aplica_moral: false },
  { clave: '620', descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',         aplica_fisica: false, aplica_moral: true  },
  { clave: '621', descripcion: 'Incorporación Fiscal',                                                              aplica_fisica: true,  aplica_moral: false },
  { clave: '622', descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',                        aplica_fisica: false, aplica_moral: true  },
  { clave: '623', descripcion: 'Opcional para Grupos de Sociedades',                                               aplica_fisica: false, aplica_moral: true  },
  { clave: '624', descripcion: 'Coordinados',                                                                       aplica_fisica: false, aplica_moral: true  },
  { clave: '625', descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', aplica_fisica: true, aplica_moral: false },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza',                                                aplica_fisica: true,  aplica_moral: true  },
];

// ─── UNIDADES DE MEDIDA ───────────────────────────────────────────────────────
const unidades = [
  { clave: 'H87', nombre: 'Pieza',             descripcion: 'Unidad de conteo para artículos individuales' },
  { clave: 'EA',  nombre: 'Elemento',          descripcion: 'Unidad de medida para elementos individuales' },
  { clave: 'KGM', nombre: 'Kilogramo',         descripcion: 'Unidad de masa del sistema métrico' },
  { clave: 'GRM', nombre: 'Gramo',             descripcion: 'Unidad de masa' },
  { clave: 'TNE', nombre: 'Tonelada',          descripcion: 'Unidad de masa equivalente a 1000 kilogramos' },
  { clave: 'MTR', nombre: 'Metro',             descripcion: 'Unidad de longitud del sistema métrico' },
  { clave: 'CMT', nombre: 'Centímetro',        descripcion: 'Unidad de longitud' },
  { clave: 'MMT', nombre: 'Milímetro',         descripcion: 'Unidad de longitud' },
  { clave: 'MTK', nombre: 'Metro cuadrado',    descripcion: 'Unidad de área' },
  { clave: 'MTQ', nombre: 'Metro cúbico',      descripcion: 'Unidad de volumen' },
  { clave: 'LTR', nombre: 'Litro',             descripcion: 'Unidad de volumen' },
  { clave: 'MLT', nombre: 'Mililitro',         descripcion: 'Unidad de volumen' },
  { clave: 'HUR', nombre: 'Hora',              descripcion: 'Unidad de tiempo' },
  { clave: 'DAY', nombre: 'Día',               descripcion: 'Unidad de tiempo' },
  { clave: 'MON', nombre: 'Mes',               descripcion: 'Unidad de tiempo' },
  { clave: 'ANN', nombre: 'Año',               descripcion: 'Unidad de tiempo' },
  { clave: 'E48', nombre: 'Unidad de servicio',descripcion: 'Unidad para servicios en general' },
  { clave: 'E51', nombre: 'Trabajo',           descripcion: 'Unidad para trabajos realizados' },
  { clave: 'ACT', nombre: 'Actividad',         descripcion: 'Unidad para actividades' },
  { clave: 'SET', nombre: 'Conjunto',          descripcion: 'Conjunto de artículos' },
  { clave: 'PR',  nombre: 'Par',               descripcion: 'Dos unidades de un mismo artículo' },
  { clave: 'XBX', nombre: 'Caja',              descripcion: 'Unidad de empaque en caja' },
  { clave: 'XPK', nombre: 'Paquete',           descripcion: 'Unidad de empaque en paquete' },
  { clave: 'XBG', nombre: 'Bolsa',             descripcion: 'Unidad de empaque en bolsa' },
  { clave: 'RO',  nombre: 'Rollo',             descripcion: 'Unidad en forma de rollo' },
  { clave: 'XBA', nombre: 'Fardo',             descripcion: 'Paquete grande de mercancía' },
  { clave: 'XBJ', nombre: 'Cubo',              descripcion: 'Unidad cúbica de empaque' },
  { clave: 'BO',  nombre: 'Botella',           descripcion: 'Unidad de envase tipo botella' },
  { clave: 'CA',  nombre: 'Lata',              descripcion: 'Envase metálico' },
  { clave: 'DZN', nombre: 'Docena',            descripcion: 'Conjunto de 12 unidades' },
  { clave: 'XBE', nombre: 'Paquete de cien',   descripcion: 'Conjunto de 100 unidades' },
  { clave: 'KT',  nombre: 'Kit',               descripcion: 'Conjunto de herramientas o artículos' },
  { clave: 'SET', nombre: 'Juego',             descripcion: 'Juego completo de artículos' },
];

// ─── PRODUCTOS Y SERVICIOS (los más comunes para ferreterías) ─────────────────
const productosServicios = [
  // Materiales de construcción
  { clave: '30101500', descripcion: 'Cemento y materiales de albañilería' },
  { clave: '30101501', descripcion: 'Cemento Portland' },
  { clave: '30101502', descripcion: 'Mortero' },
  { clave: '30101503', descripcion: 'Yeso' },
  { clave: '30101504', descripcion: 'Cal' },
  { clave: '30101700', descripcion: 'Varillas y perfiles de acero' },
  { clave: '30101800', descripcion: 'Alambre y malla de acero' },
  { clave: '30111500', descripcion: 'Materiales aislantes' },
  { clave: '30121500', descripcion: 'Ladrillos y bloques' },
  { clave: '30121501', descripcion: 'Tabique' },
  { clave: '30121502', descripcion: 'Block de concreto' },
  { clave: '30131500', descripcion: 'Madera y productos de madera para construcción' },
  { clave: '30131501', descripcion: 'Tablas de madera' },
  { clave: '30131502', descripcion: 'Triplay' },
  { clave: '30131503', descripcion: 'MDF' },
  // Pinturas y recubrimientos
  { clave: '31201500', descripcion: 'Pinturas y barnices' },
  { clave: '31201501', descripcion: 'Pintura vinílica' },
  { clave: '31201502', descripcion: 'Pintura esmalte' },
  { clave: '31201503', descripcion: 'Pintura epóxica' },
  { clave: '31201504', descripcion: 'Barniz' },
  { clave: '31201505', descripcion: 'Sellador' },
  { clave: '31201506', descripcion: 'Impermeabilizante' },
  // Herramientas manuales
  { clave: '27111500', descripcion: 'Herramientas manuales de mano' },
  { clave: '27111501', descripcion: 'Martillo' },
  { clave: '27111502', descripcion: 'Desarmadores' },
  { clave: '27111503', descripcion: 'Pinzas' },
  { clave: '27111504', descripcion: 'Llaves de tuerca' },
  { clave: '27111505', descripcion: 'Nivel de burbuja' },
  { clave: '27111506', descripcion: 'Cinta métrica' },
  { clave: '27111507', descripcion: 'Navaja de corte' },
  { clave: '27111600', descripcion: 'Herramientas de corte' },
  { clave: '27111601', descripcion: 'Sierra manual' },
  { clave: '27111602', descripcion: 'Segueta' },
  { clave: '27111603', descripcion: 'Estilete' },
  // Herramientas eléctricas
  { clave: '27112100', descripcion: 'Herramientas eléctricas portátiles' },
  { clave: '27112101', descripcion: 'Taladro eléctrico' },
  { clave: '27112102', descripcion: 'Esmeriladora angular' },
  { clave: '27112103', descripcion: 'Sierra circular eléctrica' },
  { clave: '27112104', descripcion: 'Lijadora eléctrica' },
  { clave: '27112105', descripcion: 'Rotomartillo' },
  // Materiales eléctricos
  { clave: '26111500', descripcion: 'Cables y alambres eléctricos' },
  { clave: '26111501', descripcion: 'Cable eléctrico calibre 8' },
  { clave: '26111502', descripcion: 'Cable eléctrico calibre 10' },
  { clave: '26111503', descripcion: 'Cable eléctrico calibre 12' },
  { clave: '26111504', descripcion: 'Cable eléctrico calibre 14' },
  { clave: '26121500', descripcion: 'Interruptores y contactos eléctricos' },
  { clave: '26121501', descripcion: 'Interruptor de luz' },
  { clave: '26121502', descripcion: 'Contacto eléctrico' },
  { clave: '26121503', descripcion: 'Apagador' },
  { clave: '26131500', descripcion: 'Luminarias y focos' },
  { clave: '26131501', descripcion: 'Foco LED' },
  { clave: '26131502', descripcion: 'Lámpara fluorescente' },
  { clave: '26131503', descripcion: 'Tira LED' },
  { clave: '26141500', descripcion: 'Tableros y centros de carga' },
  { clave: '26141501', descripcion: 'Centro de carga' },
  { clave: '26141502', descripcion: 'Interruptor termomagnético' },
  // Plomería
  { clave: '30181500', descripcion: 'Tubería y accesorios de plomería' },
  { clave: '30181501', descripcion: 'Tubo PVC hidráulico' },
  { clave: '30181502', descripcion: 'Tubo CPVC' },
  { clave: '30181503', descripcion: 'Tubo de cobre' },
  { clave: '30181504', descripcion: 'Tubo galvanizado' },
  { clave: '30181505', descripcion: 'Codo PVC' },
  { clave: '30181506', descripcion: 'Tee PVC' },
  { clave: '30181507', descripcion: 'Reducción PVC' },
  { clave: '30181600', descripcion: 'Válvulas y llaves de paso' },
  { clave: '30181601', descripcion: 'Llave de paso' },
  { clave: '30181602', descripcion: 'Válvula de esfera' },
  { clave: '30181603', descripcion: 'Válvula de globo' },
  { clave: '30181700', descripcion: 'Muebles sanitarios' },
  { clave: '30181701', descripcion: 'Tinaco' },
  { clave: '30181702', descripcion: 'Cisterna' },
  { clave: '30181703', descripcion: 'Bomba de agua' },
  // Tornillería y fijaciones
  { clave: '31161500', descripcion: 'Tornillos y tuercas' },
  { clave: '31161501', descripcion: 'Tornillo para madera' },
  { clave: '31161502', descripcion: 'Tornillo autorroscante' },
  { clave: '31161503', descripcion: 'Tornillo para concreto' },
  { clave: '31161504', descripcion: 'Tuerca hexagonal' },
  { clave: '31161505', descripcion: 'Rondana plana' },
  { clave: '31161506', descripcion: 'Rondana de presión' },
  { clave: '31161507', descripcion: 'Clavo' },
  { clave: '31161508', descripcion: 'Taquete' },
  { clave: '31161509', descripcion: 'Ancla de expansión' },
  // Adhesivos y selladores
  { clave: '31201600', descripcion: 'Adhesivos y pegamentos' },
  { clave: '31201601', descripcion: 'Pegamento para PVC' },
  { clave: '31201602', descripcion: 'Pegamento epóxico' },
  { clave: '31201603', descripcion: 'Silicón sellador' },
  { clave: '31201604', descripcion: 'Cinta canela' },
  { clave: '31201605', descripcion: 'Cinta de aislar' },
  // Productos de ferretería general
  { clave: '31000000', descripcion: 'Artículos de ferretería en general' },
  { clave: '30000000', descripcion: 'Estructuras y materiales de construcción' },
  { clave: '27000000', descripcion: 'Herramientas y maquinaria' },
  // Servicios
  { clave: '72000000', descripcion: 'Servicios de construcción' },
  { clave: '72101500', descripcion: 'Servicios de instalación' },
  { clave: '72101501', descripcion: 'Servicio de instalación eléctrica' },
  { clave: '72101502', descripcion: 'Servicio de instalación de plomería' },
  { clave: '72101503', descripcion: 'Servicio de instalación de pisos' },
  { clave: '76100000', descripcion: 'Servicios de mantenimiento y reparación' },
  { clave: '80100000', descripcion: 'Servicios de gestión empresarial' },
  { clave: '84000000', descripcion: 'Servicios financieros y de seguros' },
];

// ─── CÓDIGOS POSTALES y COLONIAS (muestra representativa) ────────────────────
const codigosPostales = [
  // CDMX
  { cp: '06600', estado: 'Ciudad de México', municipio: 'Cuauhtémoc' },
  { cp: '06700', estado: 'Ciudad de México', municipio: 'Cuauhtémoc' },
  { cp: '06800', estado: 'Ciudad de México', municipio: 'Cuauhtémoc' },
  { cp: '11000', estado: 'Ciudad de México', municipio: 'Miguel Hidalgo' },
  { cp: '11300', estado: 'Ciudad de México', municipio: 'Miguel Hidalgo' },
  { cp: '03100', estado: 'Ciudad de México', municipio: 'Benito Juárez' },
  { cp: '03300', estado: 'Ciudad de México', municipio: 'Benito Juárez' },
  { cp: '04000', estado: 'Ciudad de México', municipio: 'Coyoacán' },
  { cp: '14000', estado: 'Ciudad de México', municipio: 'Tlalpan' },
  // Jalisco
  { cp: '44100', estado: 'Jalisco', municipio: 'Guadalajara' },
  { cp: '44200', estado: 'Jalisco', municipio: 'Guadalajara' },
  { cp: '44600', estado: 'Jalisco', municipio: 'Guadalajara' },
  { cp: '45010', estado: 'Jalisco', municipio: 'Zapopan' },
  { cp: '45070', estado: 'Jalisco', municipio: 'Zapopan' },
  { cp: '45500', estado: 'Jalisco', municipio: 'San Pedro Tlaquepaque' },
  // Nuevo León
  { cp: '64000', estado: 'Nuevo León', municipio: 'Monterrey' },
  { cp: '64100', estado: 'Nuevo León', municipio: 'Monterrey' },
  { cp: '64600', estado: 'Nuevo León', municipio: 'Monterrey' },
  { cp: '66200', estado: 'Nuevo León', municipio: 'San Nicolás de los Garza' },
  { cp: '66450', estado: 'Nuevo León', municipio: 'San Pedro Garza García' },
  // Estado de México
  { cp: '50000', estado: 'Estado de México', municipio: 'Toluca' },
  { cp: '50200', estado: 'Estado de México', municipio: 'Toluca' },
  { cp: '53100', estado: 'Estado de México', municipio: 'Naucalpan de Juárez' },
  { cp: '54000', estado: 'Estado de México', municipio: 'Tlalnepantla de Baz' },
  { cp: '55000', estado: 'Estado de México', municipio: 'Ecatepec de Morelos' },
  // Puebla
  { cp: '72000', estado: 'Puebla', municipio: 'Puebla' },
  { cp: '72100', estado: 'Puebla', municipio: 'Puebla' },
  { cp: '72500', estado: 'Puebla', municipio: 'Puebla' },
  // Veracruz
  { cp: '91000', estado: 'Veracruz', municipio: 'Xalapa-Enríquez' },
  { cp: '91700', estado: 'Veracruz', municipio: 'Veracruz' },
  // Yucatán
  { cp: '97000', estado: 'Yucatán', municipio: 'Mérida' },
  { cp: '97070', estado: 'Yucatán', municipio: 'Mérida' },
  // Guanajuato
  { cp: '36000', estado: 'Guanajuato', municipio: 'Guanajuato' },
  { cp: '37000', estado: 'Guanajuato', municipio: 'León' },
  { cp: '37500', estado: 'Guanajuato', municipio: 'León' },
  // Querétaro
  { cp: '76000', estado: 'Querétaro', municipio: 'Querétaro' },
  { cp: '76100', estado: 'Querétaro', municipio: 'Querétaro' },
  // Chihuahua
  { cp: '31000', estado: 'Chihuahua', municipio: 'Chihuahua' },
  { cp: '32000', estado: 'Chihuahua', municipio: 'Ciudad Juárez' },
  // Sonora
  { cp: '83000', estado: 'Sonora', municipio: 'Hermosillo' },
  // Sinaloa
  { cp: '80000', estado: 'Sinaloa', municipio: 'Culiacán Rosales' },
  { cp: '82000', estado: 'Sinaloa', municipio: 'Mazatlán' },
  // Tamaulipas
  { cp: '87000', estado: 'Tamaulipas', municipio: 'Ciudad Victoria' },
  { cp: '88000', estado: 'Tamaulipas', municipio: 'Nuevo Laredo' },
  // Coahuila
  { cp: '25000', estado: 'Coahuila de Zaragoza', municipio: 'Saltillo' },
  { cp: '27000', estado: 'Coahuila de Zaragoza', municipio: 'Torreón' },
  // Michoacán
  { cp: '58000', estado: 'Michoacán de Ocampo', municipio: 'Morelia' },
  // Guerrero
  { cp: '39000', estado: 'Guerrero', municipio: 'Chilpancingo de los Bravo' },
  { cp: '39300', estado: 'Guerrero', municipio: 'Acapulco de Juárez' },
  // Oaxaca
  { cp: '68000', estado: 'Oaxaca', municipio: 'Oaxaca de Juárez' },
  // Chiapas
  { cp: '29000', estado: 'Chiapas', municipio: 'Tuxtla Gutiérrez' },
  // Baja California
  { cp: '21000', estado: 'Baja California', municipio: 'Mexicali' },
  { cp: '22000', estado: 'Baja California', municipio: 'Tijuana' },
  // Hidalgo
  { cp: '42000', estado: 'Hidalgo', municipio: 'Pachuca de Soto' },
  // Aguascalientes
  { cp: '20000', estado: 'Aguascalientes', municipio: 'Aguascalientes' },
  // Morelos
  { cp: '62000', estado: 'Morelos', municipio: 'Cuernavaca' },
  // Tabasco
  { cp: '86000', estado: 'Tabasco', municipio: 'Centro' },
  // Durango
  { cp: '34000', estado: 'Durango', municipio: 'Durango' },
  // San Luis Potosí
  { cp: '78000', estado: 'San Luis Potosí', municipio: 'San Luis Potosí' },
  // Zacatecas
  { cp: '98000', estado: 'Zacatecas', municipio: 'Zacatecas' },
  // Nayarit
  { cp: '63000', estado: 'Nayarit', municipio: 'Tepic' },
  // Colima
  { cp: '28000', estado: 'Colima', municipio: 'Colima' },
  // Tlaxcala
  { cp: '90000', estado: 'Tlaxcala', municipio: 'Tlaxcala de Xicohténcatl' },
  // Campeche
  { cp: '24000', estado: 'Campeche', municipio: 'Campeche' },
  // Quintana Roo
  { cp: '77000', estado: 'Quintana Roo', municipio: 'Othón P. Blanco' },
  { cp: '77500', estado: 'Quintana Roo', municipio: 'Benito Juárez' },
  // Baja California Sur
  { cp: '23000', estado: 'Baja California Sur', municipio: 'La Paz' },
];

const colonias = [
  { cp: '06600', colonia: 'Roma Norte',           tipo_asentamiento: 'Colonia' },
  { cp: '06700', colonia: 'Roma Sur',             tipo_asentamiento: 'Colonia' },
  { cp: '06800', colonia: 'Doctores',             tipo_asentamiento: 'Colonia' },
  { cp: '11000', colonia: 'Lomas de Chapultepec', tipo_asentamiento: 'Colonia' },
  { cp: '11300', colonia: 'Polanco',              tipo_asentamiento: 'Colonia' },
  { cp: '03100', colonia: 'Narvarte Poniente',    tipo_asentamiento: 'Colonia' },
  { cp: '03300', colonia: 'Del Valle Norte',      tipo_asentamiento: 'Colonia' },
  { cp: '04000', colonia: 'Coyoacán',             tipo_asentamiento: 'Colonia' },
  { cp: '44100', colonia: 'Centro',               tipo_asentamiento: 'Colonia' },
  { cp: '44200', colonia: 'Analco',               tipo_asentamiento: 'Colonia' },
  { cp: '64000', colonia: 'Centro',               tipo_asentamiento: 'Colonia' },
  { cp: '72000', colonia: 'Centro',               tipo_asentamiento: 'Colonia' },
  { cp: '50000', colonia: 'Centro',               tipo_asentamiento: 'Colonia' },
];

async function seed() {
  await sequelize.authenticate();
  console.log('✅ Conectado a la BD\n');

  const opts = { updateOnDuplicate: ['descripcion'] };
  const optsUsoCfdi = { updateOnDuplicate: ['descripcion', 'aplica_fisica', 'aplica_moral'] };

  process.stdout.write('📋 Formas de pago...       ');
  await CatSatFormaPago.bulkCreate(formasPago, opts);
  console.log(`${formasPago.length} registros`);

  process.stdout.write('📋 Métodos de pago...      ');
  await CatSatMetodoPago.bulkCreate(metodosPago, opts);
  console.log(`${metodosPago.length} registros`);

  process.stdout.write('📋 Usos de CFDI...         ');
  await CatSatUsoCfdi.bulkCreate(usosCfdi, optsUsoCfdi);
  console.log(`${usosCfdi.length} registros`);

  process.stdout.write('📋 Regímenes fiscales...   ');
  await CatSatRegimenFiscal.bulkCreate(regimenes, optsUsoCfdi);
  console.log(`${regimenes.length} registros`);

  process.stdout.write('📋 Unidades de medida...   ');
  const unidadesUnicas = [...new Map(unidades.map(u => [u.clave, u])).values()];
  await CatSatUnidad.bulkCreate(unidadesUnicas, { updateOnDuplicate: ['nombre', 'descripcion'] });
  console.log(`${unidadesUnicas.length} registros`);

  process.stdout.write('📋 Productos/servicios...  ');
  await CatSatProductoServicio.bulkCreate(productosServicios, opts);
  console.log(`${productosServicios.length} registros`);

  process.stdout.write('📋 Códigos postales...     ');
  await CatSatCp.bulkCreate(codigosPostales, { updateOnDuplicate: ['estado', 'municipio'] });
  console.log(`${codigosPostales.length} registros`);

  process.stdout.write('📋 Colonias...             ');
  await CatSatColonia.bulkCreate(colonias, { updateOnDuplicate: ['colonia', 'tipo_asentamiento'] });
  console.log(`${colonias.length} registros`);

  console.log('\n✅ Catálogos SAT cargados correctamente.');
  console.log('ℹ️  Para colonias/CP completos de todo México, descarga el catálogo oficial del SAT.');
  process.exit(0);
}

seed().catch(e => { console.error('❌', e.message); process.exit(1); });
