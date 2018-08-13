const Discord = require("discord.js"),
    fs = require("fs"),
    client = new Discord.Client({
        disableEveryone: true
    }),
    { get } = require("snekfetch"),
    { embedColors, prefix, token } = require("./config.json"),
    sqlite = require("sqlite"),
    FlagStore = require("./FlagStore"),
    { fromString } = FlagStore;
let { wiimmfi_api, commands, utils, production } = require("./config.json"),
    translations = { };

for (const dir of fs.readdirSync("./commands/")) {
    commands[dir.indexOf(".js") > -1 ? dir.substr(0, dir.search(".js")) : dir] = !dir.endsWith('.js') ? fs.readdirSync(`./commands/${dir}/`).map(file => file.substr(0, file.indexOf(".js"))) : [dir.substr(0, dir.indexOf(".js"))];
}

for (const util of fs.readdirSync("./utils/")) {
    utils[util.substr(0, util.search(".js"))] = require(`./utils/${util}`);
}

for(const lang of fs.readdirSync("./lang/")) {
    translations[lang.substr(0, lang.indexOf(".json"))] = require(`./lang/${lang}`);
}

sqlite.open("./database.sqlite");

// Anti-Spam
const messages = new Map();

client.on("message", async message => {
    if(production && message.author.id !== "312715611413413889") return;
    if (message.author.bot || !message.content.startsWith(prefix)) return;
    message.command = message.content.substr(prefix.length, (message.content.indexOf(" ") > -1 ? message.content.indexOf(" ") - prefix.length : message.content.length))
    message.args = message.content.replace(new RegExp(new RegExp("-flag:(" + FlagStore.flags.join("|") + ")(,(" + FlagStore.flags.join("|") + "))* *$", "g")), "").split(" ").slice(1);
    message.wiimmfi_api = wiimmfi_api;
    message.embedColors = embedColors;
    message.Discord = {
        RichEmbed: Discord.RichEmbed
    };
    message.prefix = prefix;
    message.connection = sqlite;
    message.flags = fromString(message.content);

    if (message.content.startsWith(`${prefix}recache`) && message.author.tag === "y21#0909") {
        try {
            if(message.args[0] === "FlagStore") {
              for(const flag of require("./FlagStore").flags) {
	             if (!FlagStore.flags.includes(flag)) FlagStore.flags.push(flag);
                }
                return;
            }
            delete require.cache[require.resolve(`./commands/${message.args[0]}${message.args[1] ? "/" + message.args[1] + ".js" : ".js"}`)];
            message.reply("Command recached.");
        } catch (e) {
            message.reply("Nope, an error occured: `" + e.toString() + "`");
        }
    }
    if (!commands[message.command]) return;
    if (!commands[message.command].includes(message.command) && !commands[message.command].includes(message.args[0])) return;
    if (!wiimmfi_api.lastCheck) return message.reply('data hasn\'t been initialized, yet. Please wait some more seconds.');

    if (messages.get(message.author.id) !== undefined && Date.now() - messages.get(message.author.id) < 1000) return message.reply("calm down! [Don't spam]");
    messages.set(message.author.id, Date.now());
    sqlite.get("SELECT * FROM commandstats WHERE name='" + message.command + "'").then(result => {
        if (!result) {
            sqlite.run("INSERT INTO commandstats VALUES ('" + message.command + "', 1)");
        } else sqlite.run("UPDATE commandstats SET uses=" + (result.uses + 1) + " WHERE name='" + message.command + "'");
    }).catch(err => {
        if (err.toString().includes("no such table: commandstats")) {
            sqlite.run("CREATE TABLE commandstats (`name` TEXT, `uses` INTEGER)").catch();
        }
    });
    let language = await message.connection.get("SELECT * FROM languages WHERE guild=" + message.guild.id);
    if(!language) message.translations = translations.en;
    else message.translations = translations[language.lang] || { commands: { } };
    if (message.flags.includes("del")) message.delete().catch(console.log);
    if (message.args.length === 0 || fs.existsSync("./commands/" + message.command + ".js")) require(`./commands/${message.command}.js`)(message);
    else require(`./commands/${message.command}/${message.args[0]}.js`)(message);
});


client.on('ready', async() => {
    console.log(`[${new Date().toLocaleString()}] Bot is ready (${client.guilds.size} Servers and ${client.users.size} Users.)`);
    utils.updateData(get).then(res => {
        wiimmfi_api = res;
    });
    utils.updatePresence(wiimmfi_api, client);
    setTimeout(() => utils.updatePresence(wiimmfi_api, client), 30000); // wait 30 seconds until presence change
    setInterval(() => utils.updateData(get).then(res => wiimmfi_api = res), 300000);
    setInterval(() => utils.updatePresence(wiimmfi_api, client), 300000);
});

client.on("guildCreate", guild => {
    client.channels.get("445297325095780372").send(new Discord.RichEmbed()
        .setTitle("A new guild: " + guild.name)
        .setColor(0xffff00)
        .setThumbnail(guild.iconURL)
        .addField("Members", guild.memberCount)
        .addField("Bots", (guild.members.filter(m => m.user.bot).size / guild.memberCount * 100).toFixed(1) + "%")
        .setFooter("Amount of guilds: " + client.guilds.size)
    ).then(msg => {
        msg.react("445296718070808586");
    }).catch(console.log);
});

client.on("guildDelete", guild => {
    client.channels.get("445300348903751691").send(new Discord.RichEmbed()
        .setTitle("We lost a guild: " + guild.name)
        .setColor(0xff0000)
        .setThumbnail(guild.iconURL)
        .addField("Members", guild.memberCount)
        .addField("Bots", (guild.members.filter(m => m.user.bot).size / guild.memberCount * 100).toFixed(1) + "%")
        .setFooter("Amount of guilds: " + client.guilds.size)
    ).catch(console.log);
});

client.login(token);
