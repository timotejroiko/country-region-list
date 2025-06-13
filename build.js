"use strict";

const { writeFileSync, mkdirSync, existsSync } = require("node:fs");
const { decode } = require("he");

const { compare, createMd } = require("./compare");
const dry = process.argv.some(x => x.includes("dry"));

// fetch with retry
const f = (/** @type {string} */ url, /** @type {RequestInit} */ opts) => {
	return fetch(url, opts).catch(() => fetch(url, opts).catch(() => fetch(url, opts)));
};

const missing = { // wikipedia links for missing regions
	"CC.D": "Direction_Island,_Cocos_(Keeling)_Islands",
	"CC.H": "Home_Island",
	"CC.O": "Horsburgh_Island",
	"CC.S": "South_Island,_Cocos_(Keeling)_Islands",
	"CC.W": "West_Island,_Cocos_(Keeling)_Islands",
	"CN.HK": "Hong_Kong",
	"CN.MO": "Macau",
	"CN.TW": "Taiwan",
	"CV.B": "Barlavento_Islands",
	"CV.S": "Sotavento_Islands",
	"FI.01": "Åland",
	"FR.BL": "Saint_Barthélemy",
	"FR.CP": "Clipperton_Island",
	"FR.MF": "Collectivity_of_Saint_Martin",
	"FR.NC": "New_Caledonia",
	"FR.PF": "French_Polynesia",
	"FR.PM": "Saint_Pierre_and_Miquelon",
	"FR.TF": "French_Southern_and_Antarctic_Lands",
	"FR.WF": "Wallis_and_Futuna",
	"FR.YT": "Mayotte",
	"GQ.C": "Río_Muni",
	"GQ.I": "Insular_Region_(Equatorial_Guinea)",
	"GW.L": "East,_Guinea-Bissau",
	"GW.N": "North,_Guinea-Bissau",
	"GW.S": "South,_Guinea-Bissau",
	"HM.M": "McDonald_Islands_(Australia)",
	"HM.H": "Heard_Island_and_McDonald_Islands",
	"HM.F": "Heard_Island_and_McDonald_Islands",
	"HM.S": "Heard_Island_and_McDonald_Islands",
	"HU.BC": "Békéscsaba",
	"HU.DE": "Debrecen",
	"HU.DU": "Dunaújváros",
	"HU.EG": "Eger",
	"HU.ER": "Érd",
	"HU.GY": "Győr",
	"HU.HV": "Hódmezővásárhely",
	"HU.KM": "Kecskemét",
	"HU.KV": "Kaposvár",
	"HU.MI": "Miskolc",
	"HU.NK": "Nagykanizsa",
	"HU.NY": "Nyíregyháza",
	"HU.PS": "Pécs",
	"HU.SD": "Szeged",
	"HU.SF": "Székesfehérvár",
	"HU.SH": "Szombathely",
	"HU.SK": "Szolnok",
	"HU.SN": "Sopron",
	"HU.SS": "Szekszárd",
	"HU.ST": "Salgótarján",
	"HU.TB": "Tatabánya",
	"HU.VM": "Veszprém",
	"HU.ZE": "Zalaegerszeg",
	"ID.JW": "Java",
	"ID.KA": "Kalimantan",
	"ID.ML": "Maluku_Islands",
	"ID.NU": "Lesser_Sunda_Islands",
	"ID.PP": "Western_New_Guinea",
	"ID.SL": "Sulawesi",
	"ID.SM": "Sumatra",
	"IO.DG": "Diego_Garcia",
	"IO.DI": "Danger_Island,_Great_Chagos_Bank",
	"IO.EA": "Eagle_Islands",
	"IO.EG": "Egmont_Islands",
	"IO.NI": "Nelsons_Island",
	"IO.PB": "Peros_Banhos",
	"IO.SI": "Salomon_Islands",
	"IO.TB": "Three_Brothers,_Chagos",
	"IS.STY": "Stykkishólmur",
	"KN.K": "Saint_Kitts",
	"KN.N": "Nevis",
	"MC.CL": "La_Colle,_Monaco",
	"MC.CO": "La_Condamine",
	"MC.FO": "Fontvieille,_Monaco",
	"MC.GA": "Monaco-Monte-Carlo_station",
	"MC.JE": "Jardin_Exotique_de_Monaco",
	"MC.LA": "Larvotto",
	"MC.MA": "Municipality_of_Monaco",
	"MC.MC": "Monte_Carlo",
	"MC.MG": "Les_Moneghetti",
	"MC.MO": "Monaco_City",
	"MC.MU": "Municipality_of_Monaco",
	"MC.PH": "Port_Hercules",
	"MC.SD": "Sainte-Dévote_Chapel",
	"MC.SO": "Municipality_of_Monaco",
	"MC.SP": "Municipality_of_Monaco",
	"MC.SR": "La_Rousse",
	"MC.VR": "Municipality_of_Monaco",
	"MH.L": "Ralik",
	"MH.T": "Ratak",
	"NO.22": "Jan_Mayen",
	"NO.21": "Svalbard",
	"PH.MGN": "Maguindanao_del_Norte",
	"PH.MGS": "Maguindanao_del_Sur",
	"RS.KM": "Kosovo",
	"RS.25": "Kosovo_District",
	"RS.26": "Peć_District_(Serbia)",
	"RS.27": "Prizren_District_(Serbia)",
	"RS.28": "Kosovska_Mitrovica_District_(Serbia)",
	"RS.29": "Kosovo-Pomoravlje_District",
	"SC.26": "Perseverance_Island,_Seychelles",
	"SC.27": "Perseverance_Island,_Seychelles",
	"SG.01": "Central_Region,_Singapore",
	"SG.02": "North-East_Region,_Singapore",
	"SG.03": "North_Region,_Singapore",
	"SG.04": "East_Region,_Singapore",
	"SG.05": "West_Region,_Singapore",
	"TC.AC": "Ambergris_Cay",
	"TC.DC": "Dellis_Cay",
	"TC.EC": "East_Caicos",
	"TC.FC": "Turks_and_Caicos_Islands",
	"TC.GT": "Grand_Turk_Island",
	"TC.LW": "Turks_and_Caicos_Islands",
	"TC.MC": "Middle_Caicos",
	"TC.NC": "North_Caicos",
	"TC.PN": "Pine_Cay",
	"TC.PR": "Providenciales",
	"TC.RC": "Parrot_Cay",
	"TC.SC": "South_Caicos",
	"TC.SL": "Salt_Cay,_Turks_Islands",
	"TC.WC": "West_Caicos",
	"TH.S": "Pattaya",
	"US.AS": "American_Samoa",
	"US.GU": "Guam",
	"US.MP": "Northern_Mariana_Islands",
	"US.PR": "Puerto_Rico",
	"US.UM": "United_States_Minor_Outlying_Islands",
	"US.VI": "United_States_Virgin_Islands"
};

if(!dry) {
	const d = new Date().toISOString().split("T")[0];
	if(existsSync(`./build/${d}/countries.min.json`)) {
		console.log("up to date");
		process.exit();
	}
}

console.log("fetching country list");
f("https://www.geonames.org/countries/").then(x => x.text()).then(async html => {
	const countries = [];
	const list = /** @type {List} */ (parseCountries(html));
	console.log(`found ${list.length} countries`);
	for(const row of list) {
		process.stdout.write(`fetching ${row.iso}...`);
		const [geopage, othernames, divisions] = await Promise.all([
			f(`https://www.geonames.org/countries/${row.iso}/${row.geonames}.html`).then(x => x.text()),
			f(`https://www.geonames.org/${row.iso}/other-names-for-${row.geonames}.html`).then(x => x.text()),
			f(`https://www.geonames.org/${row.iso}/administrative-division-${row.geonames}.html`).then(x => x.text())
		]);
		const data = parseNames(othernames);
		row.geonames = getGeonamesId(row.geonames, geopage) || row.geonames;
		row.wiki = row.iso === "LT" ? "Lithuania" : getWikiLink(geopage); // fix lithuania link
		row.names = data.names;
		row.langs = data.langs;
		const translations = /** @type {Translations} */ (await f(`https://en.wikipedia.org/w/api.php?action=query&titles=${row.wiki}&prop=langlinks&lllimit=500&format=json&redirects`).then(x => x.json()));
		const page = Object.values(translations.query.pages)[0];
		for(const entry of [{ lang: "en", "*": page.title }, ...page.langlinks]) {
			const name = entry["*"];
			const lang = entry.lang;
			if(!row.names.includes(name)) {
				row.names.push(name);
			}
			if(entry.lang.length === 2) {
				row.langs[lang] = row.names.indexOf(name);
			}
		}
		const admin = /** @type {Divisions} */ (parseDivisions(divisions));
		await Promise.all(admin.map(async region => {
			region.country = row.iso;
			region.names = [];
			region.langs = {};
			const k = /** @type {keyof missing} */ (`${row.iso}.${region.iso}`);
			const m = missing[k];
			if(!region.wiki) {
				if(!region.iso) { return; } // invalid regions
				if(!m) {
					console.log("missing wikipedia link", region);
					return;
				}
				region.wiki = m;
			} else if(m) {
				console.log("wikipedia link not missing anymore", region);
			}
			process.stdout.write(` ${region.iso || region.fips || region.gn}`);
			const translations2 = /** @type {Translations} */ (await f(`https://en.wikipedia.org/w/api.php?action=query&titles=${region.wiki}&prop=langlinks&lllimit=500&format=json&redirects`).then(x => x.json()));
			const page2 = Object.values(translations2.query.pages)[0];
			for(const entry of [{ lang: "en", "*": page2.title }, ...page2.langlinks || []]) {
				const name = entry["*"];
				const lang = entry.lang;
				if(!region.names.includes(name)) {
					region.names.push(name);
				}
				if(entry.lang.length === 2) {
					region.langs[lang] = region.names.indexOf(name);
				}
			}
		}));
		row.regions = admin;
		countries.push(row);
		console.log("... done");
	}
	const comp = compare(/** @type {Parameters<compare>[0]} */ (countries));
	if(Object.keys(comp).length) {
		if(!dry) {
			const d = new Date().toISOString().split("T")[0];
			mkdirSync(`./build/${d}`, { recursive: true });
			writeFileSync(`./build/${d}/countries.json`, JSON.stringify(countries, null, "\t"));
			writeFileSync(`./build/${d}/countries.min.json`, JSON.stringify(countries));
			writeFileSync(`./build/${d}/changelog.md`, createMd(`Update ${d}`, comp));
		}
	} else {
		console.log("no updates found");
	}
	console.log("Finished", `Total Countries: ${countries.length}`, `Total Regions: ${countries.reduce((a, t) => a + (t.regions?.length ?? 0), 0)}`);
});

/**
 * @param {string} html
 * @returns
 */
function parseCountries(html) {
	const list = [];
	const index = html.indexOf('id="countries">');
	const table = html.slice(index, html.indexOf("</table>", index));
	const array = convertTable(table);
	for(const row of array) {
		if(row[0]) {
			const iso = row[0].slice(row[0].indexOf("</a>") + 4);
			const iso3 = row[1] || null;
			const ison = row[2] || null;
			const fips = row[3] || null;
			const geonames = row[4].slice(row[4].indexOf("/countries/") + 14, row[4].indexOf(".html"));
			list.push({
				iso,
				iso3,
				ison,
				fips,
				geonames
			});
		}
	}
	return list;
}

/**
 * @param {string} html
 * @returns {{ names: string[], langs: Record<string, number> }}
 */
function parseNames(html) {
	const list = new Set();
	const langs = /** @type {Record<string, *>} */ ({});
	const index = html.indexOf('id="altnametable">');
	const table = html.slice(index, html.indexOf("</table>", index));
	const array = convertTable(table);
	for(const row of array) {
		if(row[2] && row[2].length === 2) {
			list.add(row[0]);
			langs[row[2]] = row[0];
		}
	}
	const names = [...list];
	for(const lang of Object.keys(langs)) {
		langs[lang] = names.indexOf(langs[lang]);
	}
	return {
		names,
		langs
	};
}

/**
 * @param {string} html
 * @returns
 */
function parseDivisions(html) {
	const list = [];
	const index = html.indexOf('id="subdivtable1">');
	const table = html.slice(index, html.indexOf("</table>", index));
	const array = convertTable(table);
	for(const row of array) {
		if(row.length) {
			if(row[0].includes("no longer exists")) {
				break;
			}
			const iso = filterRow(row[1]);
			const fips = filterRow(row[2]);
			const gn = filterRow(row[3]);
			const wiki = getWikiLink(row[4]);
			list.push({
				iso,
				fips,
				gn,
				wiki
			});
		}
	}
	if(html.indexOf('id="subdivtable2">')) {
		const index2 = html.indexOf('id="subdivtable2">');
		const table2 = html.slice(index2, html.indexOf("</table>", index2));
		const array2 = convertTable(table2);
		for(const row of array2) {
			if(row.length) {
				if(row[0].includes("no longer exists")) {
					break;
				}
				const iso = filterRow(row[1]);
				const fips = filterRow(row[3]);
				const gn = filterRow(row[4]);
				const wiki = getWikiLink(row[5]);
				list.push({
					iso,
					fips,
					gn,
					wiki
				});
			}
		}
	}
	return list;
}

/**
 * @param {string} html
 * @returns {string[][]}
 */
function convertTable(html) {
	const array = [];
	let index = html.indexOf("<tr");
	while(index > -1) {
		index += 4;
		const end = html.indexOf("</tr>", index);
		const row = html.slice(index, end);
		let i = row.indexOf("<td");
		const a = [];
		while(i > -1) {
			i = row.indexOf(">", i) + 1;
			const e = row.indexOf("</td>", i);
			a.push(decode(row.slice(i, e).trim()));
			i = row.indexOf("<td", e);
		}
		index = html.indexOf("<tr", end);
		array.push(a);
	}
	return array;
}

/**
 * @param {string} html
 */
function getWikiLink(html) {
	const match = "://en.wikipedia.org/wiki/";
	const index = html.indexOf(match);
	if(index === -1) {
		return;
	}
	const start = index + match.length;
	const end = html.indexOf('"', start);
	return html.slice(start, end);
}

/**
 * @param {string} country
 * @param {string} html
 */
function getGeonamesId(country, html) {
	const r = new RegExp(`https://www.geonames.org/(\\w+)/${country.toLowerCase()}.html`);
	const result = html.match(r);
	return result?.[1];
}

/**
 * @param {string} row
 */
function filterRow(row) {
	if(!row) { return null; }
	const index = row.indexOf(">");
	if(index === -1) { return row; }
	return row.slice(index + 1, row.indexOf("<", index)) || null;
}

/**
 * @typedef {(ReturnType<parseCountries>[0] & { wiki?: string, names?: string[], langs?: Record<string, number>, regions?: {}[] })[]} List
 */

/**
 * @typedef {(ReturnType<parseDivisions>[0] & { country?: string, names?: string[], langs?: Record<string, number> })[]} Divisions
 */

/**
 * @typedef {{ query: { pages: Record<string, { title: string, langlinks: { lang: string, "*": string }[] }> } }} Translations
 */
