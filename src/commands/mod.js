const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ContainerBuilder, 
  TextDisplayBuilder
} = require('discord.js');
const { 
  createSeparator, 
  createHeader, 
  createCallout, 
  createSectionWithThumbnail, 
  createFooter,
  buildSuccessResponse,
  buildErrorResponse
} = require('../utils/componentsV2');
const { getGuildConfig, getWarnings, addWarning, clearWarnings } = require('../utils/storage');
const config = require('../../config');

async function sendModLog(guild, title, fields) {
  const guildConf = getGuildConfig(guild.id);
  if (!guildConf.logChannelId) return;

  const logChan = guild.channels.cache.get(guildConf.logChannelId) ||
    await guild.channels.fetch(guildConf.logChannelId).catch(() => null);

  if (!logChan) return;

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.danger)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### [ 🛡️ ' LOG: ${title.toUpperCase()} ]`),
      ...fields
    )
    .addSeparatorComponents(createSeparator())
    .addTextDisplayComponents(createFooter());

  await logChan.send({
    flags: MessageFlags.IsComponentsV2,
    components: [container]
  }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Narzędzia moderacji serwera')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Otwiera panel moderacyjny użytkownika')
        .addUserOption(opt =>
          opt
            .setName('uzytkownik')
            .setDescription('Wybierz użytkownika')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('ban')
        .setDescription('Banuje użytkownika')
        .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik do zbanowania').setRequired(true))
        .addStringOption(opt => opt.setName('powod').setDescription('Powód').setRequired(false))
        .addIntegerOption(opt => opt.setName('dni_usuniecia').setDescription('Usuń wiadomości (0-7 dni)').setMinValue(0).setMaxValue(7).setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('kick')
        .setDescription('Wyrzuca użytkownika')
        .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik do wyrzucenia').setRequired(true))
        .addStringOption(opt => opt.setName('powod').setDescription('Powód').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('timeout')
        .setDescription('Wycisza użytkownika (timeout)')
        .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik do wyciszenia').setRequired(true))
        .addIntegerOption(opt => opt.setName('minuty').setDescription('Czas w minutach').setRequired(true))
        .addStringOption(opt => opt.setName('powod').setDescription('Powód').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('unmute')
        .setDescription('Zdejmuje timeout z użytkownika')
        .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('warn')
        .setDescription('Nadaje ostrzeżenie')
        .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
        .addStringOption(opt => opt.setName('powod').setDescription('Powód').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('ostrzezenia')
        .setDescription('Pokazuje listę ostrzeżeń')
        .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('czysc_ostrzezenia')
        .setDescription('Czyści ostrzeżenia użytkownika')
        .addUserOption(opt => opt.setName('uzytkownik').setDescription('Użytkownik').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Usuwa wiadomości z czatu')
        .addIntegerOption(opt => opt.setName('liczba').setDescription('Liczba wiadomości (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('lock')
        .setDescription('Blokuje pisanie na kanale')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Kanał (domyślnie bieżący)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('unlock')
        .setDescription('Odblokowuje pisanie na kanale')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Kanał (domyślnie bieżący)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('slowmode')
        .setDescription('Ustawia tryb powolny')
        .addIntegerOption(opt => opt.setName('sekundy').setDescription('Odstęp w sekundach (0 = wyłącz)').setMinValue(0).setMaxValue(21600).setRequired(true))
        .addChannelOption(opt => opt.setName('kanal').setDescription('Kanał (domyślnie bieżący)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('czysc_boty')
        .setDescription('Usuwa lub banuje inne boty z serwera')
        .addStringOption(opt =>
          opt
            .setName('akcja')
            .setDescription('Wybierz działanie')
            .setRequired(true)
            .addChoices(
              { name: '🔨 Zbanuj wszystkie boty', value: 'ban' },
              { name: '👢 Wyrzuć wszystkie boty', value: 'kick' }
            )
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'panel') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      const avatar = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
      const createdTimestamp = Math.floor(targetUser.createdTimestamp / 1000);
      const joinedText = targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : 'Poza serwerem';

      let timeoutText = 'Brak';
      if (targetMember?.communicationDisabledUntilTimestamp && targetMember.communicationDisabledUntilTimestamp > Date.now()) {
        timeoutText = `Wyciszony do <t:${Math.floor(targetMember.communicationDisabledUntilTimestamp / 1000)}:R>`;
      }

      const warnings = getWarnings(guild.id, targetUser.id);
      const rolesText = targetMember 
        ? targetMember.roles.cache.filter(r => r.id !== guild.id).map(r => `${r}`).join(', ') || 'Brak'
        : 'Brak';

      const infoLines = [
        `▎ 👤 ' **Konto:** ${targetUser} (\`${targetUser.tag}\`)`,
        `▎ 🆔 ' **ID:** \`${targetUser.id}\``,
        `▎ 📅 ' **Utworzone:** <t:${createdTimestamp}:R>`,
        `▎ 📥 ' **Dołączył:** ${joinedText}`,
        `▎ 🔇 ' **Wyciszenie:** ${timeoutText}`,
        `▎ ⚠️ ' **Warny:** \`${warnings.length}\``,
        `▎ 🎭 ' **Role:** ${rolesText}`
      ];
      const profileSection = createSectionWithThumbnail(infoLines, avatar);

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_mod_mute_${targetUser.id}`)
          .setLabel('Wycisz')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔇'),
        new ButtonBuilder()
          .setCustomId(`btn_mod_unmute_${targetUser.id}`)
          .setLabel('Odcisz')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔊'),
        new ButtonBuilder()
          .setCustomId(`btn_mod_warn_${targetUser.id}`)
          .setLabel('Warn')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚠️'),
        new ButtonBuilder()
          .setCustomId(`btn_mod_kick_${targetUser.id}`)
          .setLabel('Kick')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('👢'),
        new ButtonBuilder()
          .setCustomId(`btn_mod_ban_${targetUser.id}`)
          .setLabel('Ban')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔨')
      );

      const container = new ContainerBuilder()
        .setAccentColor(config.colors.primary)
        .addTextDisplayComponents(createHeader(`MODERACJA × ${targetUser.username}`, '🛡️'))
        .addSectionComponents(profileSection)
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('> *Wybierz akcję z poniższych przycisków.*')
        )
        .addActionRowComponents(buttonsRow)
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(createFooter());

      return await interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [container]
      });
    }

    if (sub === 'ban') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const reason = interaction.options.getString('powod') || 'Brak podanego powodu';
      const days = interaction.options.getInteger('dni_usuniecia') || 0;

      await guild.members.ban(targetUser.id, {
        deleteMessageSeconds: days * 24 * 60 * 60,
        reason: `${interaction.user.tag}: ${reason}`
      });

      await sendModLog(guild, 'Ban', [
        createCallout('🔨', 'Zbanowano', `${targetUser} (\`${targetUser.tag}\`)`),
        createCallout('👮', 'Moderator', `${interaction.user}`),
        createCallout('📝', 'Powód', reason)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Zbanowano', `Użytkownik ${targetUser} został zbanowany.\n▎ 📝 ' **Powód**: ${reason}`)
      );
    }

    if (sub === 'kick') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const reason = interaction.options.getString('powod') || 'Brak podanego powodu';
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return await interaction.reply(buildErrorResponse('Błąd', 'Użytkownik nie znajduje się na serwerze.'));
      }

      await targetMember.kick(`${interaction.user.tag}: ${reason}`);

      await sendModLog(guild, 'Wyrzucenie', [
        createCallout('👢', 'Wyrzucono', `${targetUser} (\`${targetUser.tag}\`)`),
        createCallout('👮', 'Moderator', `${interaction.user}`),
        createCallout('📝', 'Powód', reason)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Wyrzucono', `Użytkownik ${targetUser} został wyrzucony.\n▎ 📝 ' **Powód**: ${reason}`)
      );
    }

    if (sub === 'timeout') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const minutes = interaction.options.getInteger('minuty');
      const reason = interaction.options.getString('powod') || 'Brak podanego powodu';
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return await interaction.reply(buildErrorResponse('Błąd', 'Użytkownik nie znajduje się na serwerze.'));
      }

      await targetMember.timeout(minutes * 60 * 1000, `${interaction.user.tag}: ${reason}`);

      await sendModLog(guild, 'Wyciszenie', [
        createCallout('🔇', 'Wyciszono', `${targetUser} na ${minutes}m`),
        createCallout('👮', 'Moderator', `${interaction.user}`),
        createCallout('📝', 'Powód', reason)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Wyciszono', `Użytkownik ${targetUser} został wyciszony na **${minutes} min**.\n▎ 📝 ' **Powód**: ${reason}`)
      );
    }

    if (sub === 'unmute') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return await interaction.reply(buildErrorResponse('Błąd', 'Użytkownik nie znajduje się na serwerze.'));
      }

      await targetMember.timeout(null, `Odciszenie przez ${interaction.user.tag}`);

      await sendModLog(guild, 'Odciszenie', [
        createCallout('🔊', 'Odciszono', `${targetUser}`),
        createCallout('👮', 'Moderator', `${interaction.user}`)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Odciszono', `Zdjęto wyciszenie z użytkownika ${targetUser}.`)
      );
    }

    if (sub === 'warn') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const reason = interaction.options.getString('powod');

      const record = addWarning(guild.id, targetUser.id, {
        reason,
        moderatorId: interaction.user.id
      });

      await sendModLog(guild, 'Ostrzeżenie', [
        createCallout('⚠️', 'Użytkownik', `${targetUser} (\`${targetUser.tag}\`)`),
        createCallout('👮', 'Moderator', `${interaction.user}`),
        createCallout('🆔', 'ID Warnu', `\`#${record.id}\``),
        createCallout('📝', 'Powód', reason)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Nadano Warn', `Użytkownik ${targetUser} otrzymał ostrzeżenie \`#${record.id}\`.\n▎ 📝 ' **Powód**: ${reason}`)
      );
    }

    if (sub === 'ostrzezenia') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const warns = getWarnings(guild.id, targetUser.id);

      if (warns.length === 0) {
        return await interaction.reply(
          buildSuccessResponse('Brak Warnów', `Użytkownik ${targetUser} nie posiada aktywnych ostrzeżeń.`)
        );
      }

      const listDisplays = warns.map(w => 
        createCallout('⚠️', `Warn #${w.id}`, `${w.reason} (<@${w.moderatorId}> <t:${Math.floor(w.timestamp / 1000)}:R>)`)
      );

      const container = new ContainerBuilder()
        .setAccentColor(config.colors.warning)
        .addTextDisplayComponents(createHeader(`LISTA WARNÓW × ${targetUser.username}`, '📋'))
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(...listDisplays)
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(createFooter());

      return await interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [container]
      });
    }

    if (sub === 'czysc_ostrzezenia') {
      const targetUser = interaction.options.getUser('uzytkownik');
      const count = clearWarnings(guild.id, targetUser.id);

      return await interaction.reply(
        buildSuccessResponse('Wyczyszczono', `Usunięto **${count}** ostrzeżeń użytkownika ${targetUser}.`)
      );
    }

    if (sub === 'clear') {
      const amount = interaction.options.getInteger('liczba');
      const deleted = await interaction.channel.bulkDelete(amount, true).catch(err => {
        console.error('bulkDelete error:', err.message);
        return null;
      });

      if (!deleted) {
        return await interaction.reply(
          buildErrorResponse('Błąd', 'Nie udało się usunąć wiadomości (mogą być starsze niż 14 dni).')
        );
      }

      await sendModLog(guild, 'Czyszczenie Czatu', [
        createCallout('🧹', 'Kanał', `${interaction.channel}`),
        createCallout('🔢', 'Usunięto', `\`${deleted.size}\``),
        createCallout('👮', 'Moderator', `${interaction.user}`)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Wyczyszczono', `Usunięto **${deleted.size}** wiadomości.`)
      );
    }

    if (sub === 'lock') {
      const targetChan = interaction.options.getChannel('kanal') || interaction.channel;
      await targetChan.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false
      });

      await sendModLog(guild, 'Blokada Kanału', [
        createCallout('🔒', 'Kanał', `${targetChan}`),
        createCallout('👮', 'Moderator', `${interaction.user}`)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Zablokowano', `Kanał ${targetChan} został zablokowany.`)
      );
    }

    if (sub === 'unlock') {
      const targetChan = interaction.options.getChannel('kanal') || interaction.channel;
      await targetChan.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null,
        AddReactions: null
      });

      await sendModLog(guild, 'Odblokowanie Kanału', [
        createCallout('🔓', 'Kanał', `${targetChan}`),
        createCallout('👮', 'Moderator', `${interaction.user}`)
      ]);

      return await interaction.reply(
        buildSuccessResponse('Odblokowano', `Kanał ${targetChan} został odblokowany.`)
      );
    }

    if (sub === 'slowmode') {
      const seconds = interaction.options.getInteger('sekundy');
      const targetChan = interaction.options.getChannel('kanal') || interaction.channel;

      await targetChan.setRateLimitPerUser(seconds, `Slowmode przez ${interaction.user.tag}`);

      return await interaction.reply(
        buildSuccessResponse(
          'Slowmode',
          seconds === 0 
            ? `Tryb powolny na kanale ${targetChan} wyłączony.` 
            : `Ustawiono odstęp **${seconds}s** na kanale ${targetChan}.`
        )
      );
    }

    if (sub === 'czysc_boty') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const action = interaction.options.getString('akcja');
      const me = await guild.members.fetchMe();
      const members = await guild.members.fetch();
      const bots = members.filter(m => m.user.bot && m.id !== interaction.client.user.id);

      if (bots.size === 0) {
        return await interaction.editReply(
          buildSuccessResponse('Brak Botów', 'Na serwerze nie ma innych botów.')
        );
      }

      let count = 0;
      let failed = [];

      for (const [id, botMember] of bots) {
        if (me.roles.highest.position <= botMember.roles.highest.position) {
          failed.push(`${botMember.user.tag} (Rola bota ma niższą pozycję)`);
          continue;
        }
        try {
          if (action === 'ban') {
            await guild.members.ban(id, { reason: `Czyszczenie botów przez ${interaction.user.tag}` });
          } else {
            await botMember.kick(`Czyszczenie botów przez ${interaction.user.tag}`);
          }
          count++;
        } catch (e) {
          failed.push(`${botMember.user.tag} (${e.message})`);
        }
      }

      let msg = `Pomyślnie ${action === 'ban' ? 'zbanowano' : 'wyrzucono'} **${count}/${bots.size}** botów.`;
      if (failed.length > 0) {
        msg += `\n\n⚠️ Nie udało się usunąć ${failed.length} botów z powodu pozycji roli:\n` +
          failed.map(f => `• ${f}`).join('\n');
      }

      return await interaction.editReply(
        buildSuccessResponse('Czyszczenie Botów', msg)
      );
    }
  }
};
