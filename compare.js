"use strict";

const { readdirSync, createReadStream, copyFileSync, existsSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");

const dry = process.argv.some(x => x.includes("dry"));
const force = process.argv.some(x => x.includes("force"));

if(require.main === module) {
    const dirs = readdirSync("./build");
    const lastTwo = /** @type {{ d: number, p: string }[]} */ ([]);
    for(const dir of dirs) {
        const date = new Date(dir);
        if((lastTwo[1]?.d || 0) < date.getTime()) {
            lastTwo[0] = lastTwo[1];
            lastTwo[1] = { d: date.getTime(), p: dir }
        }
    }
    (async () => {
        const [rhash, lhash] = await Promise.all([
            hash(`./build/${lastTwo[1].p}/countries.min.json`),
            hash(`./build/latest/countries.min.json`)
        ]);
        if(rhash === lhash && !force) {
            console.log("nothing to compare");
            return;
        }
        if(!dry) {
            copyFileSync(`./build/${lastTwo[1].p}/countries.json`, "./build/latest/countries.json");
            copyFileSync(`./build/${lastTwo[1].p}/countries.min.json`, "./build/latest/countries.min.json");
        }
        if(existsSync(`./build/${lastTwo[1].p}/changelog.md`) && !force) {
            console.log("changelog already exists");
            return;
        }
        const prev = /** @type {Countries} */ (require(`./build/${lastTwo[0].p}/countries.min.json`));
        const current = /** @type {Countries} */ (require(`./build/${lastTwo[1].p}/countries.min.json`));
        const changes = compare(prev, current);
        const md = createMd(`Update ${lastTwo[1].p}`, changes);
        console.log(md);
        if(!dry) {
            writeFileSync(`./build/${lastTwo[1].p}/changelog.md`, md);
        }
    })();
}

/**
 * @param {Countries} json1
 * @param {Countries} [json2]
 */
function compare(json1, json2) {
    const current = /** @type {Countries} */ (json1);
    const prev = /** @type {Countries} */ (json2 || require(`./build/latest/countries.min.json`));
    const changes = /** @type {Record<string, Record<string, string[]>>} */ ({});
    for(const c of new Set([...prev.map(x => x.iso), ...current.map(x => x.iso)])) {
        const old = prev.find(x => x.iso === c);
        const cur = current.find(x => x.iso === c);
        const key = `${cur?.names[cur.langs.en] || old?.names[old.langs.en]} (${cur?.iso || old?.iso})`;
        const obj = changes[key] || (changes[key] = { major: [], added: [], removed: [], changed: [] });
        if(old && !cur) {
            obj.major.push(`Removed country`);
        } else if(cur && !old) {
            obj.major.push(`Added country`);
        } else if(old && cur) {
            if(old.iso3 !== cur.iso3) {
                obj.major.push(`Changed ISO3 country code: &nbsp; ${old.iso3} -> ${cur.iso3}`);
            }
            if(old.ison !== cur.ison) {
                obj.major.push(`Changed ISON country code: &nbsp; ${old.ison} -> ${cur.ison}`);
            }
            if(old.fips !== cur.fips) {
                obj.major.push(`Changed FIPS country code: &nbsp; ${old.fips} -> ${cur.fips}`);
            }
            if(old.geonames !== cur.geonames) {
                obj.major.push(`Changed geonames identifier: &nbsp; ${old.geonames} -> ${cur.geonames}`);
            }
            if(old.wiki !== cur.wiki) {
                obj.major.push(`Changed wikipedia link: &nbsp; ${old.wiki} -> ${cur.wiki}`);
            }
            for(const lang of new Set([...Object.keys(old.langs), ...Object.keys(cur.langs)])) {
                const l = new Intl.DisplayNames("en", { type: "language" }).of(lang);
                if(lang in old.langs && !(lang in cur.langs)) {
                    obj.removed.push(`Removed ${l} (${lang}) translation: &nbsp; **${old.names[old.langs[lang]]}**`);
                } else if(!(lang in old.langs) && lang in cur.langs) {
                    obj.added.push(`Added ${l} (${lang}) translation: &nbsp; **${cur.names[cur.langs[lang]]}**`);
                }
                else if(old.names[old.langs[lang]] !== cur.names[cur.langs[lang]]) {
                    obj.changed.push(`Changed ${l} (${lang}) translation: &nbsp; **${old.names[old.langs[lang]]}** -\u200E> **${cur.names[cur.langs[lang]]}**`);
                }
            }
            for(const r of new Set([...old.regions.map(x => x.iso), ...cur.regions.map(x => x.iso)])) {
                const oldr = old.regions.find(x => x.iso === r);
                const newr = cur.regions.find(x => x.iso === r);
                const rname = `${newr?.names[newr?.langs.en]}`;
                const riso = `${cur.iso}.${newr?.iso || newr?.fips || newr?.gn || ""}`;
                if(oldr && !newr) {
                    obj.major.push(`Removed region: &nbsp; ${oldr.names[oldr.langs.en]} (${old.iso}.${oldr.iso})`);
                } else if(newr && !oldr) {
                    obj.major.push(`Added new region: &nbsp; ${rname} (${riso})`);
                } else if(oldr && newr) {
                    if(oldr.fips !== newr.fips) {
                        obj.major.push(`Changed FIPS code for ${rname} (${riso}): &nbsp; ${oldr.fips} -> ${newr.fips}`);
                    }
                    if(oldr.gn !== newr.gn) {
                        obj.major.push(`Changed geonames identifier for ${rname} (${riso}): &nbsp; ${oldr.gn} -> ${newr.gn}`);
                    }
                    for(const lang of new Set([...Object.keys(oldr.langs), ...Object.keys(newr.langs)])) {
                        const l = new Intl.DisplayNames("en", { type: "language" }).of(lang);
                        if(lang in oldr.langs && !(lang in newr.langs)) {
                            obj.removed.push(`Removed ${l} (${lang}) translation for ${rname} (${riso}): &nbsp; **${oldr.names[oldr.langs[lang]]}**`);
                        }
                        else if(!(lang in oldr.langs) && lang in newr.langs) {
                            obj.added.push(`Added ${l} (${lang}) translation for ${rname} (${riso}): &nbsp; **${newr.names[newr.langs[lang]]}**`);
                        }
                        else if(oldr.names[oldr.langs[lang]] !== newr.names[newr.langs[lang]]) {
                            obj.changed.push(`Changed ${l} (${lang}) translation for ${rname} (${riso}): &nbsp; **${oldr.names[oldr.langs[lang]]}** -\u200E> **${newr.names[newr.langs[lang]]}**`);
                        }
                    }
                }
            }
        }
    }
    return Object.keys(changes).reduce((a, t) => {
        if(Object.values(changes[t]).some(x => x.length)) {
            a[t] = changes[t];
        }
        return a;
    }, /** @type {Record<string, Record<string, string[]>>} */ ({}));
}

/**
 * @param {string} title
 * @param {Record<string, Record<string, string[]>>} changes
 */
function createMd(title, changes) {
    const md = `
## ${title}

${Object.keys(changes).map(x => {
    const c = [
        ...changes[x].major.map(z => `**${z}**`),
        ...changes[x].added,
        ...changes[x].removed,
        ...changes[x].changed
    ].map(z => `* ${z}`).join("\n");
    return c ? `### ${x}\n\n${c}` : ""
}).filter(Boolean).sort().join("\n\n")}

`;
    return md;
}

/**
 * @param {string} path
 */
function hash(path) {
    return new Promise((resolve, reject) => {
        const hash = createHash("md5");
        const reader = createReadStream(path);
        reader.on("error", reject);
        reader.on("data", chunk => hash.update(chunk));
        reader.on("end", () => resolve(hash.digest("hex")));
    })
}

exports.compare = compare;
exports.createMd = createMd;

/**
 * @typedef {{
 *      iso: string,
 *      iso3: string?,
 *      ison: string?,
 *      geonames: string,
 *      fips: string?,
 *      wiki?: string,
 *      names: string[],
 *      langs: Record<string, number>,
 *      regions: {
 *          country: string,
 *          iso: string,
 *          fips: string,
 *          gn: string,
 *          wiki: string,
 *          names: string[],
 *          langs: Record<string, number>
 *      }[]
 * }[]} Countries
 */
