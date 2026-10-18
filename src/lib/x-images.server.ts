// Tweet images, stored in token_images and served by /api/public/img/$hash.
// The scheduled worker fetches these stable URLs; bundled asset URLs do not
// resolve in the published server build.
const BUCKET_BASE = "/api/public/img";

// Generated from /tmp/ximg/mapping.json (sha256 of each re-encoded image).
const FILE_HASHES: Record<string, string> = {
  "x-address.jpg": "d6d0fd3f869031cdf32bce65edb7e70b9a0926bf27b51ef63aaf510a4dd60873",
  "x-associate.jpg": "bd67b267e2370e4096d05acf2fa6e82b92a2bdd5600a097dd3d7ea330b98ba82",
  "x-auto-listing.jpg": "dcbb04b8d4a63f375ce8b842a4159563d4a7c56e57a64b7b5e2f86db61deea32",
  "x-behind.jpg": "15f049a8f15cca20235160c140db47ba416719640add2e4a85b8223f28761fd3",
  "x-bonding-curve.jpg": "7c4d53066a0b40369f1fe3c7811fdace5476a939c0ad31b43db016a3a2e99270",
  "x-built-on-hedera.jpg": "a50c24d5b7304d87dd41f204b1459e89911425ab9164f822d3e53223b74dc6f0",
  "x-chart.jpg": "ac4ded790c58cb0adfbfebbe2a5529e5dc9ba2188d31c5aaf17dfbcbdf6c8049",
  "x-check-numbers.jpg": "100287a0fe642b9e67445b6c4ce9e17dd5077ca147f4c90ccdaa53f69164679e",
  "x-claim.jpg": "8325ce805a1c45f02a44e3cb5022b051ba156994ba1b184b0ed373eeaf5acf69",
  "x-coin-page.jpg": "f56d980e9151cb069a95d2982ab805514220744e57fedf4380df2e60e67bfff1",
  "x-comments.jpg": "9da404cae6e1562444c841252717a9bff4d8c809b247a353f73d6a8670bec6db",
  "x-community-call.jpg": "29dd6006405f6c4c88169d52fbb8a4bb826eea2f8aab2b024efc166d3126c5c3",
  "x-community.jpg": "8fbe9f1e3fad68d10fd29f5381337e649b4e8feab2ccde33baa3b1d1349d5c4e",
  "x-creator.jpg": "88b0340e1013418861192b9d1f1ac0ac20ad5a385398c0ef9c3ccf75e651662b",
  "x-curve-market.jpg": "d6318b372108257fb2b38ce76f597ce8dd727361a5a8b8a809cfd9751adfa24b",
  "x-dyor.jpg": "ddec4ff8c4ebe2f11b6f88c4a7c7c4640b26cc716cfc179ef09864624a7f85ba",
  "x-efficient.jpg": "9f4c8ed35fd6af56b7327636fa4c05aead070002111b8975559ba2c7ba50f76a",
  "x-evm.jpg": "99da0cb4df71ec4e308d8938f5a78a98f2191bcec3eea08e9c600fdf8aec611e",
  "x-fees.jpg": "53be858c21f2015163a2fb0eab6d4a829bcc41ca8d5a5fe5eb4be900411f40c7",
  "x-fixed-supply.jpg": "0fc1e95ee65941567a2d8dffda42e4966542503caccf50cc1c91172e6922571a",
  "x-follow.jpg": "8cd71f105089eafaf223800156abb9366bb572a3502d236daa1803c812446836",
  "x-graduation.jpg": "57b9881f10a4fe12441fbbed8cb46369cbbd7700403af668307fa9d973c4839d",
  "x-hbar.jpg": "3f79df6d5e015bd9dcf27824b5fdb6e44ff64c5844dd90f2621dd6c723d3ae00",
  "x-holders.jpg": "b5da12b6b527c718082da42fb0cb02012454059744d7634de13ece6d782ed71c",
  "x-holdings.jpg": "2b51fbbc32b28c0b6298425f72e1b3d035802ecc0e635ba014c194948351c56d",
  "x-instant.jpg": "da0da96de2d5d75dba78eb26b43b71de1164368c85776d3cb957ddb5f32128cf",
  "x-introduction.jpg": "9f9da4b2e5308ed2eec77f2cd7b0795723ca610e0a9b49b2ec41b0e33993802e",
  "x-king.jpg": "dcfa052e8ccbe6b9928d46d0d0d0b1e9a4c6614a49a8c0256289a2fbac08b414",
  "x-live-in-minutes.jpg": "641b95993cd84cadd3ed7a289ead503cf6aaa9ec6a3dcfacd6fc3a14ab00518d",
  "x-mission.jpg": "34cfa65bec2f8306a32c24b41f2f678668bbe68541f24aa119aa8d34d8994cc0",
  "x-mobile.jpg": "d8e89cd021fd848b5461e470e66f172dd63f5fa6cff3c82e8a8ad2f45b87f4b9",
  "x-native.jpg": "a6e4ce7038eff7ac35d950fdcbbdff6ec5ca232b6e92e0e9a0b7b4cdfe1e911b",
  "x-no-approvals.jpg": "50f5fed931630fe81306deb760b31a75eae008964edaa2917158b85590236f70",
  "x-no-listing.jpg": "4e611f3219471cc90d435853f4c4fbdd823f9b54f4913613d1288e3831ae2cd0",
  "x-open.jpg": "ca6a81aa5cd39530d93b6be89a4ce0afe3ad444f27a7a8c1ca47dec1bd1547a9",
  "x-pnl.jpg": "c8348df8255c743c4b60b4ae1f23f30ca139b3674d4ad29d014d28f79bc0f728",
  "x-profile.jpg": "9f03137b3c98414bb1c4095122a45e5fa3d0e3e1fbc0d95f64e4ae42743ed785",
  "x-progress.jpg": "ed3371d4345962488615a2cec8f8a4a262acef4a22d633f1653a7289b65747cf",
  "x-referrals.jpg": "ba0a203f14a391ab83949f3a6cd138e5bad265f222e34ab9e9bc7ec2a7d00636",
  "x-risk.jpg": "273d50951064c402922043f398159b89a68e4ba486ad585a2a244143130370b8",
  "x-same-curve.jpg": "40b2c5004caa06c381a7cb0d75e70332a5d43e5368655086287dc5a3ff4ed402",
  "x-saucer.jpg": "c77c6741681fd76fb13de9917bf494196d1658a23ab9519a2e377ff8fd4e0d47",
  "x-sell.jpg": "116a65fcca0242f38575c159bab9877f4f22f29c6692b1b613e9cecf51b648dc",
  "x-share.jpg": "3fb2eee169244b8d6cf3043a4c0414516ad040738d3cb38263f323708e4c0db1",
  "x-social.jpg": "22a2979f21a3a43e67bdfa423f26735baeadc47c83ae6eea97e1abb5cd432b79",
  "x-speed.jpg": "fa43aecb1352f916e0e7607219475894eae08430ed37e9bc0746f72a50f210ac",
  "x-support.jpg": "721c55327a845787faab4f76079c14c09da76fe5218152e661cd7b3066f66c70",
  "x-ticker.jpg": "54dad7b07c47717e6d6f0e14d45d551a2a77fc7f064e56f6d122648f6e3ec576",
  "x-wallets.jpg": "02761df6882525b6f94a88c665159e72eebe1dc0787d04e58f1c2ae03ff075cc",
  "x-your-coin.jpg": "3a61fe94ad715e04d594e3ad3b8a21571936b23ed5c19d92108638d323503ab1",
};

export const topicImageUrls: string[] = Object.entries(FILE_HASHES)
  .filter(([, hash]) => hash)
  .map(([, hash]) => `${BUCKET_BASE}/${hash}`);
