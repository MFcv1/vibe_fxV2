/*
 * Presets importes de Lightroom.
 *
 * GENERE PAR `scripts/import-lightroom-preset.mjs`. Ne pas editer a la main.
 * Chaque entree porte une table de conversion capturee par Hald CLUT.
 */

import ar01 from './ar01.js';
import ar02 from './ar02.js';
import ar03 from './ar03.js';
import ar04 from './ar04.js';
import ar05 from './ar05.js';
import ar06 from './ar06.js';
import ar07 from './ar07.js';
import ar08 from './ar08.js';
import ar09 from './ar09.js';
import ar10 from './ar10.js';
import ar11 from './ar11.js';
import bw01 from './bw01.js';
import bw02 from './bw02.js';
import bw03 from './bw03.js';
import bw04 from './bw04.js';
import bw05 from './bw05.js';
import bw06 from './bw06.js';
import bw07 from './bw07.js';
import bw08 from './bw08.js';
import bw09 from './bw09.js';
import bw10 from './bw10.js';
import bw11 from './bw11.js';
import bw12 from './bw12.js';
import cn01 from './cn01.js';
import cn02 from './cn02.js';
import cn03 from './cn03.js';
import cn04 from './cn04.js';
import cn05 from './cn05.js';
import cn06 from './cn06.js';
import cn07 from './cn07.js';
import cn08 from './cn08.js';
import cn09 from './cn09.js';
import cn10 from './cn10.js';
import cn11 from './cn11.js';
import cn12 from './cn12.js';
import cn13 from './cn13.js';
import cn14 from './cn14.js';
import cn15 from './cn15.js';
import cn16 from './cn16.js';
import cn17 from './cn17.js';
import cn18 from './cn18.js';
import film_bleu_delave from './film-bleu-delave.js';
import film_bleu_profond from './film-bleu-profond.js';
import film_braise_douce from './film-braise-douce.js';
import film_braise_puissante from './film-braise-puissante.js';
import film_noir_blanc_audacieux from './film-noir-blanc-audacieux.js';
import film_noir_blanc_chaud from './film-noir-blanc-chaud.js';
import film_noir_blanc_froid from './film-noir-blanc-froid.js';
import film_noir_blanc_silencieux from './film-noir-blanc-silencieux.js';
import film_or_chaud from './film-or-chaud.js';
import film_or_riche from './film-or-riche.js';
import film_sauge_legere from './film-sauge-legere.js';
import film_sauge_profonde from './film-sauge-profonde.js';
import ft01 from './ft01.js';
import ft02 from './ft02.js';
import ft03 from './ft03.js';
import ft04 from './ft04.js';
import ft05 from './ft05.js';
import ft06 from './ft06.js';
import ft07 from './ft07.js';
import ft08 from './ft08.js';
import ft09 from './ft09.js';
import ft10 from './ft10.js';
import ft11 from './ft11.js';
import ft12 from './ft12.js';
import lf01 from './lf01.js';
import lf02 from './lf02.js';
import lf03 from './lf03.js';
import lf04 from './lf04.js';
import lf05 from './lf05.js';
import lf06 from './lf06.js';
import lf07 from './lf07.js';
import lf08 from './lf08.js';
import ln01 from './ln01.js';
import ln02 from './ln02.js';
import ln03 from './ln03.js';
import ln04 from './ln04.js';
import ln05 from './ln05.js';
import ln06 from './ln06.js';
import ln07 from './ln07.js';
import ln08 from './ln08.js';
import ln09 from './ln09.js';
import ln10 from './ln10.js';
import pb01 from './pb01.js';
import pb02 from './pb02.js';
import pb03 from './pb03.js';
import pb04 from './pb04.js';
import pb05 from './pb05.js';
import pb06 from './pb06.js';
import pb07 from './pb07.js';
import pb08 from './pb08.js';
import pb09 from './pb09.js';
import pb10 from './pb10.js';
import pb11 from './pb11.js';
import pb12 from './pb12.js';
import pd01_jaune from './pd01-jaune.js';
import pd01_orange from './pd01-orange.js';
import pd01_rouge from './pd01-rouge.js';
import pd02_jaune from './pd02-jaune.js';
import pd02_orange from './pd02-orange.js';
import pd02_rouge from './pd02-rouge.js';
import pd03_jaune from './pd03-jaune.js';
import pd03_orange from './pd03-orange.js';
import pd03_rouge from './pd03-rouge.js';
import pd04_jaune from './pd04-jaune.js';
import pd04_orange from './pd04-orange.js';
import pd04_rouge from './pd04-rouge.js';
import pd05_jaune from './pd05-jaune.js';
import pd05_orange from './pd05-orange.js';
import pd05_rouge from './pd05-rouge.js';
import pe01 from './pe01.js';
import pe02 from './pe02.js';
import pe03 from './pe03.js';
import pe04 from './pe04.js';
import pe05 from './pe05.js';
import pe06 from './pe06.js';
import pe07 from './pe07.js';
import pe08 from './pe08.js';
import pe09 from './pe09.js';
import pe10 from './pe10.js';
import pe11 from './pe11.js';
import pe12 from './pe12.js';
import pg01 from './pg01.js';
import pg02 from './pg02.js';
import pg03 from './pg03.js';
import pg04 from './pg04.js';
import pg05 from './pg05.js';
import pg06 from './pg06.js';
import pg07 from './pg07.js';
import pg08 from './pg08.js';
import pl01 from './pl01.js';
import pl02 from './pl02.js';
import pl03 from './pl03.js';
import pl04 from './pl04.js';
import pl05 from './pl05.js';
import pl06 from './pl06.js';
import pl07 from './pl07.js';
import pl08 from './pl08.js';
import pl09 from './pl09.js';
import pl10 from './pl10.js';
import pl11 from './pl11.js';
import pm01 from './pm01.js';
import pm02 from './pm02.js';
import pm03 from './pm03.js';
import pm04 from './pm04.js';
import pm05 from './pm05.js';
import pm06 from './pm06.js';
import pm07 from './pm07.js';
import pm08 from './pm08.js';
import pm09 from './pm09.js';
import pm10 from './pm10.js';
import pm11 from './pm11.js';
import sm01 from './sm01.js';
import sm02 from './sm02.js';
import sm03 from './sm03.js';
import sm04 from './sm04.js';
import sm05 from './sm05.js';
import sm06 from './sm06.js';
import sm07 from './sm07.js';
import sm08 from './sm08.js';
import sm09 from './sm09.js';
import sm10 from './sm10.js';
import sm11 from './sm11.js';
import sp01 from './sp01.js';
import sp02 from './sp02.js';
import sp03 from './sp03.js';
import sp04 from './sp04.js';
import sp05 from './sp05.js';
import sp06 from './sp06.js';
import sp07 from './sp07.js';
import sp08 from './sp08.js';
import sp09 from './sp09.js';
import sp10 from './sp10.js';
import sp11 from './sp11.js';
import sp12 from './sp12.js';
import tm01 from './tm01.js';
import tm02 from './tm02.js';
import tm03 from './tm03.js';
import tm04 from './tm04.js';
import tm05 from './tm05.js';
import tm06 from './tm06.js';
import tm07 from './tm07.js';
import tm08 from './tm08.js';
import tm09 from './tm09.js';
import tm10 from './tm10.js';
import tm11 from './tm11.js';
import tm12 from './tm12.js';
import tr01 from './tr01.js';
import tr02 from './tr02.js';
import tr03 from './tr03.js';
import tr04 from './tr04.js';
import tr05 from './tr05.js';
import tr06 from './tr06.js';
import tr07 from './tr07.js';
import tr08 from './tr08.js';
import tr09 from './tr09.js';
import tr10 from './tr10.js';
import tr11 from './tr11.js';
import tr12 from './tr12.js';
import tr13 from './tr13.js';
import tr14 from './tr14.js';
import tr15 from './tr15.js';
import tr16 from './tr16.js';
import tr17 from './tr17.js';
import tr18 from './tr18.js';
import ua01 from './ua01.js';
import ua02 from './ua02.js';
import ua03 from './ua03.js';
import ua04 from './ua04.js';
import ua05 from './ua05.js';
import ua06 from './ua06.js';
import ua07 from './ua07.js';
import ua08 from './ua08.js';
import ua09 from './ua09.js';
import ua10 from './ua10.js';
import vn01 from './vn01.js';
import vn02 from './vn02.js';
import vn03 from './vn03.js';
import vn04 from './vn04.js';
import vn05 from './vn05.js';
import vn06 from './vn06.js';
import vn07 from './vn07.js';
import vn08 from './vn08.js';
import vn09 from './vn09.js';
import vn10 from './vn10.js';
import wn01 from './wn01.js';
import wn02 from './wn02.js';
import wn03 from './wn03.js';
import wn04 from './wn04.js';
import wn05 from './wn05.js';
import wn06 from './wn06.js';
import wn07 from './wn07.js';
import wn08 from './wn08.js';
import wn09 from './wn09.js';
import wn10 from './wn10.js';

export const IMPORTED_PRESETS = [
    ar01,
    ar02,
    ar03,
    ar04,
    ar05,
    ar06,
    ar07,
    ar08,
    ar09,
    ar10,
    ar11,
    bw01,
    bw02,
    bw03,
    bw04,
    bw05,
    bw06,
    bw07,
    bw08,
    bw09,
    bw10,
    bw11,
    bw12,
    cn01,
    cn02,
    cn03,
    cn04,
    cn05,
    cn06,
    cn07,
    cn08,
    cn09,
    cn10,
    cn11,
    cn12,
    cn13,
    cn14,
    cn15,
    cn16,
    cn17,
    cn18,
    film_bleu_delave,
    film_bleu_profond,
    film_braise_douce,
    film_braise_puissante,
    film_noir_blanc_audacieux,
    film_noir_blanc_chaud,
    film_noir_blanc_froid,
    film_noir_blanc_silencieux,
    film_or_chaud,
    film_or_riche,
    film_sauge_legere,
    film_sauge_profonde,
    ft01,
    ft02,
    ft03,
    ft04,
    ft05,
    ft06,
    ft07,
    ft08,
    ft09,
    ft10,
    ft11,
    ft12,
    lf01,
    lf02,
    lf03,
    lf04,
    lf05,
    lf06,
    lf07,
    lf08,
    ln01,
    ln02,
    ln03,
    ln04,
    ln05,
    ln06,
    ln07,
    ln08,
    ln09,
    ln10,
    pb01,
    pb02,
    pb03,
    pb04,
    pb05,
    pb06,
    pb07,
    pb08,
    pb09,
    pb10,
    pb11,
    pb12,
    pd01_jaune,
    pd01_orange,
    pd01_rouge,
    pd02_jaune,
    pd02_orange,
    pd02_rouge,
    pd03_jaune,
    pd03_orange,
    pd03_rouge,
    pd04_jaune,
    pd04_orange,
    pd04_rouge,
    pd05_jaune,
    pd05_orange,
    pd05_rouge,
    pe01,
    pe02,
    pe03,
    pe04,
    pe05,
    pe06,
    pe07,
    pe08,
    pe09,
    pe10,
    pe11,
    pe12,
    pg01,
    pg02,
    pg03,
    pg04,
    pg05,
    pg06,
    pg07,
    pg08,
    pl01,
    pl02,
    pl03,
    pl04,
    pl05,
    pl06,
    pl07,
    pl08,
    pl09,
    pl10,
    pl11,
    pm01,
    pm02,
    pm03,
    pm04,
    pm05,
    pm06,
    pm07,
    pm08,
    pm09,
    pm10,
    pm11,
    sm01,
    sm02,
    sm03,
    sm04,
    sm05,
    sm06,
    sm07,
    sm08,
    sm09,
    sm10,
    sm11,
    sp01,
    sp02,
    sp03,
    sp04,
    sp05,
    sp06,
    sp07,
    sp08,
    sp09,
    sp10,
    sp11,
    sp12,
    tm01,
    tm02,
    tm03,
    tm04,
    tm05,
    tm06,
    tm07,
    tm08,
    tm09,
    tm10,
    tm11,
    tm12,
    tr01,
    tr02,
    tr03,
    tr04,
    tr05,
    tr06,
    tr07,
    tr08,
    tr09,
    tr10,
    tr11,
    tr12,
    tr13,
    tr14,
    tr15,
    tr16,
    tr17,
    tr18,
    ua01,
    ua02,
    ua03,
    ua04,
    ua05,
    ua06,
    ua07,
    ua08,
    ua09,
    ua10,
    vn01,
    vn02,
    vn03,
    vn04,
    vn05,
    vn06,
    vn07,
    vn08,
    vn09,
    vn10,
    wn01,
    wn02,
    wn03,
    wn04,
    wn05,
    wn06,
    wn07,
    wn08,
    wn09,
    wn10,
];
