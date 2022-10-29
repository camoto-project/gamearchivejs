/*
 * File format aggregator.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// These file formats all have signatures so the autodetection is fast and they
// are listed first.
export { default as arc_bnk_harry } from './arc-bnk-harry.js';
export { default as arc_bnk_carnage } from './arc-bnk-carnage.js';
export { default as arc_dlt_stargunner } from './arc-dlt-stargunner.js';
export { default as arc_epf_eastpoint } from './arc-epf-eastpoint.js';
export { default as arc_glb_raptor } from './arc-glb-raptor.js';
export { default as arc_grp_build } from './arc-grp-build.js';
export { default as arc_gw_homebrew } from './arc-gw-homebrew.js';
export { default as arc_hog_descent } from './arc-hog-descent.js';
export { default as arc_gxlib } from './arc-gxlib.js';
export { default as arc_rff_blood_v200 } from './arc-rff-blood-v200.js';
export { default as arc_rff_blood_v300 } from './arc-rff-blood-v300.js';
export { default as arc_rff_blood_v301 } from './arc-rff-blood-v301.js';
export { default as arc_wad_doom } from './arc-wad-doom.js';
export { default as arc_exe_ddave } from './arc-exe-ddave.js';
export { default as arc_exe_doofus } from './arc-exe-doofus.js';
export * from './arc-exe-hocus.js';
export * from './arc-exe-keen4.js';
export * from './arc-exe-keen5.js';
export * from './arc-exe-keen6.js';
export { default as arc_exe_ccaves1 } from './arc-exe-ccaves1.js';
export { default as arc_exe_ccaves2 } from './arc-exe-ccaves2.js';
export { default as arc_exe_ccaves3 } from './arc-exe-ccaves3.js';
// This one is last because it will also match the other .exe files.
export { default as arc_exe_generic } from './arc-exe-generic.js';

// These files have supps so they'll be discounted quickly if the extra files
// are unavailable.
export { default as arc_gd_doofus } from './arc-gd-doofus.js';
export { default as arc_gamemaps_id } from './arc-gamemaps-id.js';
export { default as arc_gamemaps_id_carmack } from './arc-gamemaps-id-carmack.js';

// These formats require enumeration, sometimes all the way to the end of the
// file, so they are last.
export { default as arc_dat_fast } from './arc-dat-fast.js';
export { default as arc_dat_got } from './arc-dat-got.js';
export { default as arc_dat_wacky } from './arc-dat-wacky.js';
export { default as arc_pod_tv } from './arc-pod-tv.js';
export { default as arc_dat_indy500 } from './arc-dat-indy500.js';
export { default as arc_dat_papyrus_v1 } from './arc-dat-papyrus-v1.js';
export { default as arc_dat_papyrus_v2 } from './arc-dat-papyrus-v2.js';
export { default as arc_cur_prehistorik } from './arc-cur-prehistorik.js';
export { default as arc_bpa_drally } from './arc-bpa-drally.js';
export { default as arc_vol_cosmo } from './arc-vol-cosmo.js';
export { default as arc_lbr_vinyl } from './arc-lbr-vinyl.js';
export { default as arc_dat_lostvikings } from './arc-dat-lostvikings.js';

// These files cannot be autodetected at all.
export { default as arc_dat_hocus } from './arc-dat-hocus.js';
