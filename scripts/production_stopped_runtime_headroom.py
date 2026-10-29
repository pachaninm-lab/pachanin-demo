#!/usr/bin/env python3
"""Separately admitted image-only recovery. Never restart or alter a volume."""
import argparse
import fcntl
import hashlib
import http.client
import json
import os
import re
import socket
import stat
import subprocess
import sys

EXPECTED_REFS = (('12bfcce897d597a3ccdd9bf31983068f9a10b7ffd18d03a40ad1c61a4e12674a', 'sha256:4d7ca23ed1e7e090c3e2f1b89e1b89e836b420ee7f378b93f639bb7f0581a6fc'), ('17516de051ffd378f3622d5a07d4d3ef57cfc1932487e874a26d9bfaa995bf8a', 'sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e'), ('6119f0e5fac156df9259ab6e5567e992662b22908606752f659685c4b2fe3950', 'sha256:844f60b64e4724a5aa8245e019dace0d3f199f7433ce6c57676cb30a920dbad9'), ('653b305a8005c24a1fea5f91ffdcdb7700e7422c313f1b3418eb14b218f90d1a', 'sha256:9ec337037ee981951c014137f1ecff53c23db0a932e916ad560b56f8c198923e'), ('6eb7ab343f41a718e82e0c827352ee32bcf13faff62d7c6670f58d8bbabc0b84', 'sha256:a8f08480e1f88f2647fed492d1178c06abb0d0c1fbf02c682a61e2f483fb3954'), ('7043af9bad5ca06a4e5b41866dc63d4889e8be524fbf3da79e474b4d1a729b6f', 'sha256:4c1ca296ef525f108f5d3552cc337c0c09587cf8dae7f0067fd93349e47dc1cd'), ('7358c38820f8e01e60f26d76f033c6bd9cddf89a534ef5cecf2a2d2224e6029e', 'sha256:33f923b05f64ca54ac4401c01126a6b92afe839a0aa0a52bc5aeb5cc958e5f20'), ('aed36194798b430728291a901c135bbd6b8b2d0ac01cdd1bded91710b25b595f', 'sha256:2f567fcecb11c8db3de549f178a1f4a3817ed5c86b27143775cc8e1ad4cc0f27'), ('d6e112cce121edd1c18972e3b73cd5b63d8733d32d43cf21cd32f14adb9a4862', 'sha256:4d7ca23ed1e7e090c3e2f1b89e1b89e836b420ee7f378b93f639bb7f0581a6fc'), ('e643540aecc11ff0158fdca743af410e8746bb7ed408c9cc8b5dd3fccb618d65', 'sha256:4a9a5687ef842f091619ba0c442901c1d760bff225231cd4dbc70b411ce74d49'), ('ebcd97792d16557493f7b9ec46ddb50d3c57bf2abaedbc2fde6832b8116363a4', 'sha256:24cdd3a7fa89d2bed150560ebea81ff1943badfa61e51d66bb541a6b0d7fb047'))
_CANDIDATE_PINS = (
    {'id': 'sha256:a1aad119237cdd82b1f4d1ad3d830cd117267470d8359cf10dada349e374c815', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', 'b05c3ae9ed43b945669fe51d3906a91e7acdf722'), ('pc-crop-transfer/web@sha256', ':', 'a1aad119237cdd82b1f4d1ad3d830cd117267470d8359cf10dada349e374c815')], 'revision': 'b05c3ae9ed43b945669fe51d3906a91e7acdf722', 'created': '2026-10-11T20:33:30.64631666Z'},
    {'id': 'sha256:4b300d46d6f1bc0ea5b04a05c292072ba688c8bab3c69b199ce2c1110967492d', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', 'b05c3ae9ed43b945669fe51d3906a91e7acdf722'), ('pc-crop-transfer/api@sha256', ':', '4b300d46d6f1bc0ea5b04a05c292072ba688c8bab3c69b199ce2c1110967492d')], 'revision': 'b05c3ae9ed43b945669fe51d3906a91e7acdf722', 'created': '2026-10-11T20:32:37.200588908Z'},
    {'id': 'sha256:f3d7429169b9588edb15bc30d0f785aacc8e1ec322c93052785cda917f702a0f', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', 'b05c3ae9ed43b945669fe51d3906a91e7acdf722'), ('pc-crop-transfer/migration@sha256', ':', 'f3d7429169b9588edb15bc30d0f785aacc8e1ec322c93052785cda917f702a0f')], 'revision': 'b05c3ae9ed43b945669fe51d3906a91e7acdf722', 'created': '2026-10-11T20:32:11.446182279Z'},
    {'id': 'sha256:53258879b6988f16c6ece5aaf4dde0de57b00ff5e72d8f1d48c19123d86b273a', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', '3c340ef1fa355bad813ccd1a4fe485a64004cf09'), ('pc-crop-transfer/web@sha256', ':', '53258879b6988f16c6ece5aaf4dde0de57b00ff5e72d8f1d48c19123d86b273a')], 'revision': '3c340ef1fa355bad813ccd1a4fe485a64004cf09', 'created': '2026-10-11T18:20:41.107460359Z'},
    {'id': 'sha256:fd793fef31559046a0878683619b87223ea513189270a73995001c973b0b010d', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '3c340ef1fa355bad813ccd1a4fe485a64004cf09'), ('pc-crop-transfer/api@sha256', ':', 'fd793fef31559046a0878683619b87223ea513189270a73995001c973b0b010d')], 'revision': '3c340ef1fa355bad813ccd1a4fe485a64004cf09', 'created': '2026-10-11T18:19:09.336084277Z'},
    {'id': 'sha256:91cd7b5a8e719e5b386c006eafba9810d3d294400035b183c8d6ca7765db56f3', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '3c340ef1fa355bad813ccd1a4fe485a64004cf09'), ('pc-crop-transfer/migration@sha256', ':', '91cd7b5a8e719e5b386c006eafba9810d3d294400035b183c8d6ca7765db56f3')], 'revision': '3c340ef1fa355bad813ccd1a4fe485a64004cf09', 'created': '2026-10-11T18:18:34.863615688Z'},
    {'id': 'sha256:d7bafe64617728abd545e60df91aaf031a73a51cbf55a11a7b9a3dbe501b0d39', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '1b0b6889a352391e77eb3814ee186b41b16053a2'), ('pc-crop-transfer/api@sha256', ':', 'd7bafe64617728abd545e60df91aaf031a73a51cbf55a11a7b9a3dbe501b0d39')], 'revision': '1b0b6889a352391e77eb3814ee186b41b16053a2', 'created': '2026-10-05T15:12:37.032730217Z'},
    {'id': 'sha256:fdfcd61759f904ec02b0828c5ad6709a30e82aa1b71349f4a988ae650e7823bf', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '1b0b6889a352391e77eb3814ee186b41b16053a2'), ('pc-crop-transfer/migration@sha256', ':', 'fdfcd61759f904ec02b0828c5ad6709a30e82aa1b71349f4a988ae650e7823bf')], 'revision': '1b0b6889a352391e77eb3814ee186b41b16053a2', 'created': '2026-10-05T15:12:31.194380483Z'},
    {'id': 'sha256:679b54bb3bafe00520a4f8c0648920f9447aeee2882b47d78afffd33858f94a9', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '06f686d52247ebe7805f1b75d937b2ca8daf8f6f'), ('pc-crop-transfer/api@sha256', ':', '679b54bb3bafe00520a4f8c0648920f9447aeee2882b47d78afffd33858f94a9')], 'revision': '06f686d52247ebe7805f1b75d937b2ca8daf8f6f', 'created': '2026-09-27T19:56:19.398755521Z'},
    {'id': 'sha256:9e8e2f40bbc107c88281722b3c96db1c85bfc11f55c40a6b03f90de3e6608f1f', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '06f686d52247ebe7805f1b75d937b2ca8daf8f6f'), ('pc-crop-transfer/migration@sha256', ':', '9e8e2f40bbc107c88281722b3c96db1c85bfc11f55c40a6b03f90de3e6608f1f')], 'revision': '06f686d52247ebe7805f1b75d937b2ca8daf8f6f', 'created': '2026-09-27T19:55:58.928630222Z'},
    {'id': 'sha256:ca3c6584b35a75d10205032dd4f29f77ea4e0843e32d6f042f3b199e17f57e6a', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', 'bdecafb969b2dd3f3862d385a7e11b8181177946'), ('pc-crop-transfer/web@sha256', ':', 'ca3c6584b35a75d10205032dd4f29f77ea4e0843e32d6f042f3b199e17f57e6a')], 'revision': 'bdecafb969b2dd3f3862d385a7e11b8181177946', 'created': '2026-09-27T16:14:56.706450491Z'},
    {'id': 'sha256:29fdf5225c5bf9911bd00840dfe580aa9696915438efcc44fd0fb2e2c7b2f870', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', 'bdecafb969b2dd3f3862d385a7e11b8181177946'), ('pc-crop-transfer/migration@sha256', ':', '29fdf5225c5bf9911bd00840dfe580aa9696915438efcc44fd0fb2e2c7b2f870')], 'revision': 'bdecafb969b2dd3f3862d385a7e11b8181177946', 'created': '2026-09-27T16:12:50.933285573Z'},
    {'id': 'sha256:d2c1e1fc386a363c0f81d4e1e83f880cdcc70d44997842287f8c60b49bff326d', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', 'bdecafb969b2dd3f3862d385a7e11b8181177946'), ('pc-crop-transfer/api@sha256', ':', 'd2c1e1fc386a363c0f81d4e1e83f880cdcc70d44997842287f8c60b49bff326d')], 'revision': 'bdecafb969b2dd3f3862d385a7e11b8181177946', 'created': '2026-09-27T16:12:02.941302405Z'},
    {'id': 'sha256:5faab3e4282f3b803ac5c24fa4a228030349a14292d30f135ec1064afac557e7', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', '337e123ac52bfe5be3e0db8bb4cf0601f275edc8'), ('pc-crop-transfer/web@sha256', ':', '5faab3e4282f3b803ac5c24fa4a228030349a14292d30f135ec1064afac557e7')], 'revision': '337e123ac52bfe5be3e0db8bb4cf0601f275edc8', 'created': '2026-09-27T02:18:03.421034847Z'},
    {'id': 'sha256:ba18419818e75ec3a179f7b97414f30d5c1abf1b9f94e4ffef0bd2daee2a60ca', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '337e123ac52bfe5be3e0db8bb4cf0601f275edc8'), ('pc-crop-transfer/api@sha256', ':', 'ba18419818e75ec3a179f7b97414f30d5c1abf1b9f94e4ffef0bd2daee2a60ca')], 'revision': '337e123ac52bfe5be3e0db8bb4cf0601f275edc8', 'created': '2026-09-27T02:16:24.303954361Z'},
    {'id': 'sha256:05ecc7cc9420766db40fd503ebe45dd8fdf87c753f9f99c3062b4fc3f392a229', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '337e123ac52bfe5be3e0db8bb4cf0601f275edc8'), ('pc-crop-transfer/migration@sha256', ':', '05ecc7cc9420766db40fd503ebe45dd8fdf87c753f9f99c3062b4fc3f392a229')], 'revision': '337e123ac52bfe5be3e0db8bb4cf0601f275edc8', 'created': '2026-09-27T02:16:02.978949352Z'},
    {'id': 'sha256:a15c1c9efe20e8c7d33a0c54390afd79bcf3e4ec2c8d835e626f68c735564641', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', '202093945454dd1c743741c7821b60fecc17a2fc'), ('pc-crop-transfer/web@sha256', ':', 'a15c1c9efe20e8c7d33a0c54390afd79bcf3e4ec2c8d835e626f68c735564641')], 'revision': '202093945454dd1c743741c7821b60fecc17a2fc', 'created': '2026-09-27T00:43:58.475318773Z'},
    {'id': 'sha256:a0655c724362ed9d0739bd7288a8f1d6fc1eea99bfb650b6b1d754e09569ac15', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '202093945454dd1c743741c7821b60fecc17a2fc'), ('pc-crop-transfer/api@sha256', ':', 'a0655c724362ed9d0739bd7288a8f1d6fc1eea99bfb650b6b1d754e09569ac15')], 'revision': '202093945454dd1c743741c7821b60fecc17a2fc', 'created': '2026-09-27T00:41:55.051117706Z'},
    {'id': 'sha256:c3203f9095cd2362d413d9a508ffde11539e4c154e27e94e6f2f9ebad22783b6', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '202093945454dd1c743741c7821b60fecc17a2fc'), ('pc-crop-transfer/migration@sha256', ':', 'c3203f9095cd2362d413d9a508ffde11539e4c154e27e94e6f2f9ebad22783b6')], 'revision': '202093945454dd1c743741c7821b60fecc17a2fc', 'created': '2026-09-27T00:41:46.868262054Z'},
    {'id': 'sha256:a3cd9b50da8ac834f9ee463d7efedff5200f9680d6608fef6b56e6f866592768', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', '18e02668f84f7f88842779a9097f145504b105bb'), ('pc-crop-transfer/web@sha256', ':', 'a3cd9b50da8ac834f9ee463d7efedff5200f9680d6608fef6b56e6f866592768')], 'revision': '18e02668f84f7f88842779a9097f145504b105bb', 'created': '2026-09-26T22:47:32.249335327Z'},
    {'id': 'sha256:9d2fe4419d7abf2d99f3e7c980679d2ab8bd0ff7cb6d99bddba5a9c76c9784ca', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '18e02668f84f7f88842779a9097f145504b105bb'), ('pc-crop-transfer/api@sha256', ':', '9d2fe4419d7abf2d99f3e7c980679d2ab8bd0ff7cb6d99bddba5a9c76c9784ca')], 'revision': '18e02668f84f7f88842779a9097f145504b105bb', 'created': '2026-09-26T22:45:54.918471918Z'},
    {'id': 'sha256:51d10fa5108251c7105718bed072e563148b4675c3be28a49c1502f8b49ceaaf', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '18e02668f84f7f88842779a9097f145504b105bb'), ('pc-crop-transfer/migration@sha256', ':', '51d10fa5108251c7105718bed072e563148b4675c3be28a49c1502f8b49ceaaf')], 'revision': '18e02668f84f7f88842779a9097f145504b105bb', 'created': '2026-09-26T22:45:33.290891786Z'},
    {'id': 'sha256:6da5baabea788f520cfab5c22daec7437f0cdd71fd18c8317e41be03420c169a', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', '35ce3841f15572bfcba7c8d7e03afb858da0888d'), ('pc-crop-transfer/web@sha256', ':', '6da5baabea788f520cfab5c22daec7437f0cdd71fd18c8317e41be03420c169a')], 'revision': '35ce3841f15572bfcba7c8d7e03afb858da0888d', 'created': '2026-09-26T17:23:09.393294053Z'},
    {'id': 'sha256:6f6dc52644b2b307d58a8f85efe8c09b3db06868a0130c9b7281bcd031a828dc', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '35ce3841f15572bfcba7c8d7e03afb858da0888d'), ('pc-crop-transfer/api@sha256', ':', '6f6dc52644b2b307d58a8f85efe8c09b3db06868a0130c9b7281bcd031a828dc')], 'revision': '35ce3841f15572bfcba7c8d7e03afb858da0888d', 'created': '2026-09-26T17:21:53.073352425Z'},
    {'id': 'sha256:9c840dcffbec3d0feb966b9d8571b06d6fb0c1dd707e073c3ce71a9f75eacc2a', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '35ce3841f15572bfcba7c8d7e03afb858da0888d'), ('pc-crop-transfer/migration@sha256', ':', '9c840dcffbec3d0feb966b9d8571b06d6fb0c1dd707e073c3ce71a9f75eacc2a')], 'revision': '35ce3841f15572bfcba7c8d7e03afb858da0888d', 'created': '2026-09-26T17:21:30.950834394Z'},
    {'id': 'sha256:4ccea94710e28ac1c328f476929ef2665c2e5fdd2779f52de7eda74400e753e1', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', '45343a799c6a8b0753ce5d29b77de9a3e30ef67e'), ('pc-crop-transfer/web@sha256', ':', '4ccea94710e28ac1c328f476929ef2665c2e5fdd2779f52de7eda74400e753e1')], 'revision': '45343a799c6a8b0753ce5d29b77de9a3e30ef67e', 'created': '2026-09-26T09:31:56.867728216Z'},
    {'id': 'sha256:201bd721a59d291b380fddcf568217a7b400a6371a02c932068ba2a20dd23bff', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '45343a799c6a8b0753ce5d29b77de9a3e30ef67e'), ('pc-crop-transfer/api@sha256', ':', '201bd721a59d291b380fddcf568217a7b400a6371a02c932068ba2a20dd23bff')], 'revision': '45343a799c6a8b0753ce5d29b77de9a3e30ef67e', 'created': '2026-09-26T09:30:05.441449699Z'},
    {'id': 'sha256:115dfe4315574ccf1761597d41ca49f832983f7f8737e03d9dd00ab87e9cc1e6', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '45343a799c6a8b0753ce5d29b77de9a3e30ef67e'), ('pc-crop-transfer/migration@sha256', ':', '115dfe4315574ccf1761597d41ca49f832983f7f8737e03d9dd00ab87e9cc1e6')], 'revision': '45343a799c6a8b0753ce5d29b77de9a3e30ef67e', 'created': '2026-09-26T09:29:40.703765115Z'},
    {'id': 'sha256:f612c944a6cfa81eb785277441b50fd22026be9146df5824fa0794cad52d0e78', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', '9504fa801603669709ff8f7157ab6a5e0abcda70'), ('pc-crop-transfer/web@sha256', ':', 'f612c944a6cfa81eb785277441b50fd22026be9146df5824fa0794cad52d0e78')], 'revision': '9504fa801603669709ff8f7157ab6a5e0abcda70', 'created': '2026-09-26T07:31:09.174052283Z'},
    {'id': 'sha256:94a12e6ee2d450e7d7bd2ac2368fc52a435cd041c5e0864c3b59a26a046bb205', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', '9504fa801603669709ff8f7157ab6a5e0abcda70'), ('pc-crop-transfer/api@sha256', ':', '94a12e6ee2d450e7d7bd2ac2368fc52a435cd041c5e0864c3b59a26a046bb205')], 'revision': '9504fa801603669709ff8f7157ab6a5e0abcda70', 'created': '2026-09-26T07:28:57.552917154Z'},
    {'id': 'sha256:874c13b75195100754176dc0836597a14cad351e05aeedb1aef5cec923dd5e63', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', '9504fa801603669709ff8f7157ab6a5e0abcda70'), ('pc-crop-transfer/migration@sha256', ':', '874c13b75195100754176dc0836597a14cad351e05aeedb1aef5cec923dd5e63')], 'revision': '9504fa801603669709ff8f7157ab6a5e0abcda70', 'created': '2026-09-26T07:28:34.513994473Z'},
    {'id': 'sha256:c059daadc018e45039c741a44eb8ef407b301023c5bbe9b769291a1c23e46d02', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', 'b8a3cffbb527468edaf12186b1cf78e71c1880a1'), ('pc-crop-transfer/web@sha256', ':', 'c059daadc018e45039c741a44eb8ef407b301023c5bbe9b769291a1c23e46d02')], 'revision': 'b8a3cffbb527468edaf12186b1cf78e71c1880a1', 'created': '2026-09-26T04:06:43.47010224Z'},
    {'id': 'sha256:cf001d46c9b2475ce2c5715d280aea47458f493dfc387c7cf371a1dcc50cf17a', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', 'b8a3cffbb527468edaf12186b1cf78e71c1880a1'), ('pc-crop-transfer/api@sha256', ':', 'cf001d46c9b2475ce2c5715d280aea47458f493dfc387c7cf371a1dcc50cf17a')], 'revision': 'b8a3cffbb527468edaf12186b1cf78e71c1880a1', 'created': '2026-09-26T04:05:00.884095911Z'},
    {'id': 'sha256:c2fcd47c39c56106563381c2f61b264bdaf5bc195b9d9d4087152a49a2e19d6f', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', 'b8a3cffbb527468edaf12186b1cf78e71c1880a1'), ('pc-crop-transfer/migration@sha256', ':', 'c2fcd47c39c56106563381c2f61b264bdaf5bc195b9d9d4087152a49a2e19d6f')], 'revision': 'b8a3cffbb527468edaf12186b1cf78e71c1880a1', 'created': '2026-09-26T04:04:46.512902978Z'},
    {'id': 'sha256:6265ba6eb7a34c5d796ac3d73a9b3a49452617f557414d7d612060c53b350d10', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', 'a445c448232c406bacf99aa6b4804814626f12fa'), ('pc-crop-transfer/web@sha256', ':', '6265ba6eb7a34c5d796ac3d73a9b3a49452617f557414d7d612060c53b350d10')], 'revision': 'a445c448232c406bacf99aa6b4804814626f12fa', 'created': '2026-09-26T02:17:39.520562494Z'},
    {'id': 'sha256:bc817251c0779c06c1da2010f2b376067fca012470074b001b696acf3c1d037c', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', 'a445c448232c406bacf99aa6b4804814626f12fa'), ('pc-crop-transfer/migration@sha256', ':', 'bc817251c0779c06c1da2010f2b376067fca012470074b001b696acf3c1d037c')], 'revision': 'a445c448232c406bacf99aa6b4804814626f12fa', 'created': '2026-09-26T02:15:59.457312974Z'},
    {'id': 'sha256:01bc0bd9ece1c44fcb370e3964a7e458d3119f8a058a548727733441501faff6', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', 'a445c448232c406bacf99aa6b4804814626f12fa'), ('pc-crop-transfer/api@sha256', ':', '01bc0bd9ece1c44fcb370e3964a7e458d3119f8a058a548727733441501faff6')], 'revision': 'a445c448232c406bacf99aa6b4804814626f12fa', 'created': '2026-09-26T02:14:15.705418883Z'},
    {'id': 'sha256:5ffb0a71b1cc1e18bb37f8ca4256443d8132fe715533a1940de72653d3ac1174', 'component': 'web', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/web', ':', 'ec8fe20a473224248c29ef725514e878f18eb850'), ('pc-crop-transfer/web@sha256', ':', '5ffb0a71b1cc1e18bb37f8ca4256443d8132fe715533a1940de72653d3ac1174')], 'revision': 'ec8fe20a473224248c29ef725514e878f18eb850', 'created': '2026-09-25T22:08:05.720335221Z'},
    {'id': 'sha256:4b8b9c1effa5713a539cda4df2e74f2128b0bc954b4f5a778901b3a422a3b0ee', 'component': 'api', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/api', ':', 'ec8fe20a473224248c29ef725514e878f18eb850'), ('pc-crop-transfer/api@sha256', ':', '4b8b9c1effa5713a539cda4df2e74f2128b0bc954b4f5a778901b3a422a3b0ee')], 'revision': 'ec8fe20a473224248c29ef725514e878f18eb850', 'created': '2026-09-25T22:07:28.897295685Z'},
    {'id': 'sha256:cc4714a9ede0b695dab7c4b24383780887c39d210e2e44cc024db4aba4ac1b5c', 'component': 'migration', 'namespace': 'EXACT_SHA_TRANSFER_ALIAS', 'refs': [('pc-crop-transfer/migration', ':', 'ec8fe20a473224248c29ef725514e878f18eb850'), ('pc-crop-transfer/migration@sha256', ':', 'cc4714a9ede0b695dab7c4b24383780887c39d210e2e44cc024db4aba4ac1b5c')], 'revision': 'ec8fe20a473224248c29ef725514e878f18eb850', 'created': '2026-09-25T22:06:14.43571801Z'},
)
CANDIDATES = tuple({**item, "refs": ["".join(parts) for parts in item["refs"]]} for item in _CANDIDATE_PINS)
RESERVE_IDS = frozenset(['sha256:13a99697559fde7ff8245b4d0c2cd7b90eb3292a3e31a79d1bc0d01a85fa4ce8', 'sha256:41a3900d11ffe088b3226f7a8951b6282ebdb1705dc7b336dbfaee3102af164a', 'sha256:4a9a5687ef842f091619ba0c442901c1d760bff225231cd4dbc70b411ce74d49', 'sha256:4d7ca23ed1e7e090c3e2f1b89e1b89e836b420ee7f378b93f639bb7f0581a6fc', 'sha256:58f1a6b4c2878f9c4f634a1b9f0d8da281883a45ce3a9db22d5fd051b9273685', 'sha256:95c60694dc993377abafa3be51250f67aff75a0fadc4f70d3fa8358310f2b026', 'sha256:9fb62d1b17da5c227a13ff1ad5c516e176201de5449bb3217839b345fe7576b2', 'sha256:b23c7fe9f4463475a3c5a9b3a61b4be1d5c0fa284474b3080eef1076838fdc52', 'sha256:b9567aaecb630ae4641ac5c663d105687b0611bd7ee90ac2b156b8a9ad06a6b1', 'sha256:c4ea2c75d86b514d40948fa2a3f4dedadd3079eb833fcd959b53d79ea393c6b3', 'sha256:e7dc10ad63727b24252f754445b49a02ef2a7d7d56c57f689d4e23afe814fc26'])
REQUIRED_KB = 5 * 1024 * 1024
TARGET_KB = 6 * 1024 * 1024
IMAGE_ID = re.compile(r'sha256:[0-9a-f]{64}')
CONTAINER_ID = re.compile(r'[0-9a-f]{64}')
ROOT = '/var/lib/docker'
SNAPSHOT_ROOT = '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs'


class RecoveryError(Exception):
    pass


def require(condition, code):
    if not condition:
        raise RecoveryError(code)


def metadata(root=ROOT):
    """No-follow, non-atime read of every config; hashes stay inside the host."""
    require(hasattr(os, 'O_NOATIME'), 'NON_ATIME_UNSUPPORTED')
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_NOATIME
    root_fd = os.open(root, flags)
    directory_fd = None
    records = []
    mounts = set()
    try:
        directory_fd = os.open('containers', flags, dir_fd=root_fd)
        with os.scandir(directory_fd) as entries:
            names = []
            for entry in entries:
                require(len(names) < 32, 'METADATA_LIMIT')
                names.append(entry.name)
        require(len(names) == len(EXPECTED_REFS), 'METADATA_COUNT')
        for cid in sorted(names):
            require(CONTAINER_ID.fullmatch(cid), 'METADATA_DIRECTORY')
            child_fd = os.open(cid, flags, dir_fd=directory_fd)
            try:
                fd = os.open('config.v2.json', os.O_RDONLY | os.O_NOFOLLOW |
                             os.O_NOATIME | os.O_NONBLOCK, dir_fd=child_fd)
                try:
                    before = os.fstat(fd)
                    require(stat.S_ISREG(before.st_mode) and before.st_size <= 4 * 1024 * 1024,
                            'METADATA_TYPE_SIZE')
                    with os.fdopen(fd, 'rb', closefd=False) as handle:
                        raw = handle.read(4 * 1024 * 1024 + 1)
                    after = os.fstat(fd)
                    require(len(raw) <= 4 * 1024 * 1024 and
                            (before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
                            (after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'METADATA_CHANGED')
                    value = json.loads(raw)
                finally:
                    os.close(fd)
            finally:
                os.close(child_fd)
            require(isinstance(value, dict) and value.get('ID') == cid and
                    isinstance(value.get('Image'), str) and IMAGE_ID.fullmatch(value['Image']),
                    'METADATA_IDENTITY')
            records.append((cid, value['Image'], hashlib.sha256(raw).hexdigest()))
            points = value.get('MountPoints')
            require(isinstance(points, dict), 'MOUNTS_UNKNOWN')
            for point in points.values():
                require(isinstance(point, dict), 'MOUNT_UNKNOWN')
                if point.get('Type') == 'volume':
                    name = point.get('Name')
                    require(isinstance(name, str) and 0 < len(name) <= 255, 'VOLUME_UNKNOWN')
                    mounts.add(name)
        require([(cid, image) for cid, image, _ in records] == sorted(map(tuple, EXPECTED_REFS)),
                'HISTORICAL_REFERENCE_MISMATCH')
        return tuple(records), frozenset(mounts)
    finally:
        if directory_fd is not None:
            os.close(directory_fd)
        os.close(root_fd)


class UnixConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')


class Host:
    def command(self, argv, allow_failure=False):
        result = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=60)
        require(allow_failure or result.returncode == 0, 'DOCKER_COMMAND_FAILED')
        require(len(result.stdout) <= 16 * 1024 * 1024, 'COMMAND_OUTPUT_LIMIT')
        return result

    def read_api(self, path):
        require(path in ('/v1.51/images/json?all=1', '/v1.51/info'), 'API_PATH')
        connection = UnixConnection('localhost', timeout=15)
        try:
            connection.request('GET', path)
            response = connection.getresponse()
            require(response.status == 200, 'DOCKER_API_UNAVAILABLE')
            raw = response.read(16 * 1024 * 1024 + 1)
            require(len(raw) <= 16 * 1024 * 1024, 'API_OUTPUT_LIMIT')
            return json.loads(raw)
        finally:
            connection.close()

    def observe_empty_containerd(self, info):
        # Engine image-use counters describe Docker's own container store only.
        value = info.get('Containerd') if isinstance(info, dict) else None
        address = value.get('Address') if isinstance(value, dict) else None
        namespaces = value.get('Namespaces') if isinstance(value, dict) else None
        require(address in ('/run/containerd/containerd.sock', '/var/run/containerd/containerd.sock',
                            '/run/docker/containerd/containerd.sock', '/var/run/docker/containerd/containerd.sock')
                and isinstance(namespaces, dict) and namespaces.get('Containers') == 'moby',
                'CONTAINERD_ENDPOINT_UNKNOWN')
        try:
            details = os.lstat(address)
        except OSError:
            raise RecoveryError('CONTAINERD_SOCKET_UNAVAILABLE') from None
        require(stat.S_ISSOCK(details.st_mode) and details.st_uid == 0, 'CONTAINERD_SOCKET_IDENTITY')
        for kind in ('containers', 'tasks'):
            try:
                result = self.command(['ctr', '--address', address, '--namespace', 'moby',
                                       kind, 'list', '--quiet'], allow_failure=True)
            except (OSError, subprocess.TimeoutExpired):
                raise RecoveryError('CONTAINERD_PROBE_UNAVAILABLE') from None
            require(result.returncode == 0, 'CONTAINERD_INVENTORY_UNAVAILABLE')
            require(not result.stdout.strip(), 'CONTAINERD_OBJECTS_PRESENT')

    def observe(self):
        require(not os.environ.get('DOCKER_HOST') and not os.environ.get('DOCKER_CONTEXT')
                and not os.environ.get('DOCKER_API_VERSION'), 'DOCKER_CONTEXT_ENV')
        endpoint = self.command(['docker', 'context', 'inspect', '--format',
                                 '{{.Endpoints.docker.Host}}']).stdout.decode().strip()
        require(endpoint == 'unix:///var/run/docker.sock', 'DOCKER_ENDPOINT')
        require(not self.command(['docker', 'ps', '-aq', '--no-trunc']).stdout.strip(),
                'DAEMON_CONTAINERS_PRESENT')
        info = self.read_api('/v1.51/info')
        require(isinstance(info, dict) and info.get('DockerRootDir') == ROOT and
                info.get('Driver') == 'overlayfs', 'DOCKER_STORAGE_CHANGED')
        self.observe_empty_containerd(info)
        require(os.stat(ROOT).st_dev == os.stat(SNAPSHOT_ROOT).st_dev,
                'STORAGE_FILESYSTEM_CHANGED')
        configs, mount_names = metadata()
        volumes = tuple(sorted(self.command(['docker', 'volume', 'ls', '-q']).stdout.splitlines()))
        networks = tuple(sorted(self.command(['docker', 'network', 'ls', '-q', '--no-trunc']).stdout.splitlines()))
        require(len(set(volumes)) == len(volumes) == 19 and len(set(networks)) == len(networks) == 6,
                'OBJECT_COUNTS_CHANGED')
        require({name.encode() for name in mount_names}.issubset(volumes), 'MOUNTED_VOLUME_MISSING')
        images = self.read_api('/v1.51/images/json?all=1')
        require(isinstance(images, list) and len(images) <= 2048, 'IMAGE_INVENTORY_UNKNOWN')
        all_ids, used = set(), set()
        for item in images:
            require(isinstance(item, dict) and isinstance(item.get('Id'), str) and
                    IMAGE_ID.fullmatch(item['Id']) and type(item.get('Containers')) is int and
                    item['Containers'] >= 0, 'IMAGE_USAGE_UNKNOWN')
            all_ids.add(item['Id'])
            if item['Containers']:
                used.add(item['Id'])
        protected = {image for _, image, _ in configs}
        require(used.issubset(protected), 'UNRECONCILED_CONTAINERD_REFERENCE')
        require(protected.issubset(all_ids), 'PROTECTED_IMAGE_MISSING')
        return configs, volumes, networks, frozenset(all_ids), frozenset(used)

    def available_kb(self):
        value = os.statvfs(SNAPSHOT_ROOT)
        return value.f_bavail * value.f_frsize // 1024

    def inspect(self, image_id):
        require(IMAGE_ID.fullmatch(image_id), 'IMAGE_ID')
        result = self.command(['docker', 'image', 'inspect', image_id], allow_failure=True)
        if result.returncode:
            return None
        values = json.loads(result.stdout)
        require(isinstance(values, list) and len(values) == 1 and
                isinstance(values[0], dict) and values[0].get('Id') == image_id, 'IMAGE_INSPECT')
        return values[0]

    def remove(self, image_id):
        require(IMAGE_ID.fullmatch(image_id), 'IMAGE_ID')
        return self.command(['docker', 'image', 'rm', '--no-prune', image_id],
                            allow_failure=True).returncode == 0


def attest_image(item, candidate, target_sha):
    require(isinstance(item, dict), 'CANDIDATE_MISSING')
    config = item.get('Config')
    labels = config.get('Labels') if isinstance(config, dict) else None
    revision = labels.get('org.opencontainers.image.revision') if isinstance(labels, dict) else None
    require(revision == candidate['revision'] and revision != target_sha and
            revision != 'a6784252a57a8a5e14f231bc18a64d67ab0fd274', 'REVISION_CHANGED')
    refs = []
    for key in ('RepoTags', 'RepoDigests'):
        values = item.get(key)
        values = [] if values is None else values
        require(isinstance(values, list) and all(isinstance(x, str) for x in values), 'REFERENCES_UNKNOWN')
        refs.extend(values)
    require(sorted(set(refs)) == candidate['refs'], 'REFERENCES_CHANGED')


def recover(host, target_sha, candidates=CANDIDATES, emit=None, reserve_ids=RESERVE_IDS):
    require(re.fullmatch('[0-9a-f]{40}', target_sha), 'INVALID_SHA')
    baseline = host.observe()
    require(reserve_ids.issubset(baseline[3]), 'ROLLBACK_RESERVE_MISSING')
    protected = {image for _, image, _ in baseline[0]} | set(baseline[4]) | set(reserve_ids)
    require(all(c['id'] not in protected for c in candidates), 'PROTECTED_CANDIDATE')
    for candidate in candidates:
        attest_image(host.inspect(candidate['id']), candidate, target_sha)
    removed = set()
    before = host.available_kb()
    attempts = failures = 0
    for candidate in candidates:
        if host.available_kb() >= TARGET_KB:
            break
        current = host.observe()
        require(current[:3] == baseline[:3] and current[3] == baseline[3] - removed,
                'PRE_REMOVAL_DRIFT')
        require(candidate['id'] not in current[4], 'NEW_CONTAINER_REFERENCE')
        attest_image(host.inspect(candidate['id']), candidate, target_sha)
        attempts += 1
        accepted = host.remove(candidate['id'])
        if emit:
            emit({'stage': 'REMOVAL_ATTEMPT_RETURNED', 'targetSha': target_sha,
                  'attempt': attempts, 'accepted': accepted, 'outcome': 'NOT_YET_RECONCILED'})
        after_item = host.inspect(candidate['id'])
        if after_item is None:
            require(accepted, 'UNKNOWN_REMOVAL_OUTCOME')
            removed.add(candidate['id'])
        else:
            require(not accepted, 'UNKNOWN_REMOVAL_OUTCOME')
            # A refused command may have partially changed aliases. Reconcile
            # the exact refs/revision before considering another candidate.
            attest_image(after_item, candidate, target_sha)
            failures += 1
        after = host.observe()
        require(after[:3] == baseline[:3] and after[3] == baseline[3] - removed,
                'POST_REMOVAL_DRIFT')
    # Reconcile even when free space was already sufficient and no removal ran.
    final = host.observe()
    require(final[:3] == baseline[:3] and final[3] == baseline[3] - removed,
            'FINAL_INVENTORY_DRIFT')
    available = host.available_kb()
    return {'schemaVersion': 'pc.stopped-runtime-headroom.v1', 'targetSha': target_sha,
            'beforeAvailableKb': before, 'afterAvailableKb': available, 'attemptedImages': attempts,
            'deletedImages': len(removed), 'refusedImages': failures,
            'passed': available >= REQUIRED_KB, 'targetReached': available >= TARGET_KB,
            'metadataUnchanged': True, 'volumesUnchanged': True, 'networksUnchanged': True,
            'runtimeRestored': False, 'volumeDataIntegrity': 'NOT_ATTESTED'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sha', required=True)
    parser.add_argument('--execute', action='store_true', required=True)
    args = parser.parse_args()
    try:
        require(os.geteuid() == 0, 'ROOT_REQUIRED')
        fd = os.open('/run/pc-crop-stopped-headroom.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            details = os.fstat(fd)
            require(stat.S_ISREG(details.st_mode) and details.st_uid == 0 and
                    stat.S_IMODE(details.st_mode) == 0o600, 'LOCK_IDENTITY')
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            report = recover(Host(), args.sha, emit=lambda value: print(json.dumps(value), flush=True))
        finally:
            os.close(fd)
        print(json.dumps(report, separators=(',', ':')))
        return 0 if report['passed'] else 2
    except Exception as error:
        code = str(error) if isinstance(error, RecoveryError) else 'UNCLASSIFIED_FAILURE'
        print(json.dumps({'schemaVersion': 'pc.stopped-runtime-headroom.v1', 'passed': False,
                          'errorCode': code, 'runtimeRestored': False, 'mutationOutcome': 'RECONCILIATION_REQUIRED_IF_STARTED'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
