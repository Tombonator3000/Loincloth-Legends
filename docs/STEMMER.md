# Stemmemanus

Manus for innleste replikker i Loincloth Legends: hvem som sier hva, hvordan stemmene lages, og hva filene skal hete. Spillet spiller en replikk automatisk når teksten vises (fortelleren, utrop, snakkebobler, sjefene og heltenes replikker), så snart fila finnes i lydbanken. Mangler fila, vises bare teksten som før.

## Regler

- Stemmene lages med **stemmedesign** i VoiceStudio: en beskrivelse av stemmen (kjønn, alder, tonehøyde, aksent) i stedet for et opptak av en ekte person. Da trengs ingen tillatelse fra noen.
- **Ingen kloning av ekte personer**, heller ikke kjendiser eller skuespillere, uten skriftlig tillatelse. Tom kan bruke sin egen stemme som referanse (det er hans egen), for eksempel til Thrugg.
- VoiceStudio er AGPL-3.0. Vi bruker det bare som et verktøy på egen maskin. Ingen kode fra VoiceStudio skal inn i dette repoet. Lydfilene vi lager, er våre.
- Modellene i VoiceStudio har egne lisenser. Standardmotoren (OmniVoice) er den som er beskrevet her; sjekk lisensen til en annen motor før du bruker den.

## Slik lager du replikkene

1. Installer VoiceStudio på egen maskin (https://github.com/debpalash/VoiceStudio, knappen Download, eller `curl -fsSL https://voicestudio.sh/install | sh` på Mac og Linux). Den laster ned modellen første gang.
2. Åpne **Voice Design**. Lim inn beskrivelsen for stemmen fra tabellen under.
3. Skriv replikken nøyaktig som i manuset. Pauser: skriv `[pause 300ms]` mellom setninger der fortelleren skal holde igjen. Store bokstaver går fint.
4. Når stemmen låter riktig, **lås den** (lagre profilen eller lås seed), så alle replikkene til samme figur får samme stemme.
5. Eksporter som WAV med filnavnet fra tabellen (for eksempel `v_they_are_blue_that_is_the_only_difference.wav`).
6. Legg filene i `voice/inbox/` og kjør:

   ```bash
   python3 tools/make_sounds.py --stemmer
   ```

   Verktøyet klipper stillheten, normaliserer, koder MP3 til `public/assets/sound/`, fører dem opp i `sound.json` og `KILDER.md`, og flytter originalene til `voice/inbox/behandlet/`.
7. Spill brettet og hør etter. Er en replikk feil, lag den på nytt med samme filnavn og kjør verktøyet igjen.

Begynn med prioritet A (fortelleren, utropene, sjefene og kjempetrollet). Da får spillet mest liv for minst arbeid.

## Filnavnene

Filnavnet regnes ut fra teksten, slik spillet gjør (`voiceId()` i `src/core/audio.ts`): `v_` og teksten med små bokstaver, der alt som ikke er bokstav eller tall blir én understrek, høyst 60 tegn. Heltinnene har egne opptak av de samme replikkene med `_f` til slutt; finnes ikke `_f`-fila, bruker spillet den vanlige. Endres en replikk i spillet, endres filnavnet også.

## Stemmene

Lim beskrivelsen inn i feltet for stemmebeskrivelse (Voice Design) i VoiceStudio. Beskrivelsen bruker bare ordene VoiceStudio forstår (kjønn, alder, tonehøyde, aksent).

| Stemme | Brukes til | Beskrivelse i VoiceStudio | Regi |
|---|---|---|---|
| NARRATOR | Forteller og utroper | `male, middle-aged, very low pitch, american accent` | Som en filmtrailer fra 1985: langsomt, dypt og dødsseriøst, også når replikken er tullete. Utropene (FIGHT!, METAL MODE!) kort og kraftig. |
| THRUGG | Mannlige helter | `male, young adult, low pitch, british accent` | Selvsikker barbar, høy og stolt, litt for fornøyd med seg selv. |
| VALKYRA | Kvinnelige helter | `female, young adult, moderate pitch, british accent` | Tørr og selvsikker, med et skjevt smil i stemmen. Filene får _f til slutt. |
| VORTHAX | Skurken | `male, elderly, low pitch, british accent` | Teatralsk skurk som prøver hardt å være ond, men bare får til moderat. |
| PRINCESS AMBERLY | Prinsessen | `female, young adult, high pitch, american accent` | Kjeder seg grenseløst. |
| BIG MAMA HOGMOTHER | Sjef, sletta | `female, middle-aged, low pitch` | Rasende, bekymret mor. |
| KING CROAKUS | Sjef, sumpen | `male, elderly, low pitch, british accent` | Kongelig, slepende og kvekkete. |
| MAGMOR THE MOLTEN | Sjef, vulkanen | `male, middle-aged, very low pitch` | Buldrende, og plutselig sårbar i den andre replikken. |
| TROLL | Istrollet og kjempetrollet | `male, middle-aged, very low pitch` | Enkel trolltale, tungt og sakte. |
| SKJELETT | Skjelettene | `male, teenager, high pitch` | Nervøs praktikant. |
| GRISEMANN | Hogman og Hog Guard | `male, middle-aged, low pitch` | Grynt og brøl mellom ordene. |
| KULTIST | Kultistene | `male, young adult, moderate pitch, british accent` | Messende og litt flau. |
| GNOME | Gnomene | `male, elderly, very high pitch` | Ren panikk. |
| ZOMBIE | Zombiene | `male, middle-aged, very low pitch` | Stønnende og treg. |
| FROSKEMANN | Froskemennene | `male, young adult, high pitch` | Stolt kongens garde, litt fuktig. |
| IMP | Ildimpene og oppryddings-impen | `male, teenager, very high pitch` | Frekk og stresset. |
| DUELLANT | Motstanderne i duellene | `male, middle-aged, low pitch, american accent` | Brautende bryter. |

### NARRATOR

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_stage_1.wav` | A | STAGE 1 |
| `v_stage_2.wav` | A | STAGE 2 |
| `v_stage_3.wav` | A | STAGE 3 |
| `v_stage_4.wav` | A | STAGE 4 |
| `v_final_stage.wav` | A | FINAL STAGE |
| `v_night_camp.wav` | A | NIGHT CAMP |
| `v_the_heroes_sleep_the_gnomes_do_not.wav` | A | THE HEROES SLEEP. THE GNOMES DO NOT. |
| `v_the_road_to_glory_is_paved_with_skeletons_and_also_regular_p.wav` | A | THE ROAD TO GLORY IS PAVED WITH SKELETONS. AND ALSO REGULAR PAVING. |
| `v_it_smells_like_a_wet_dog_ate_another_wet_dog.wav` | A | IT SMELLS LIKE A WET DOG ATE ANOTHER WET DOG. |
| `v_so_cold_that_even_the_loincloths_wear_loincloths.wav` | A | SO COLD THAT EVEN THE LOINCLOTHS WEAR LOINCLOTHS. |
| `v_the_floor_is_lava_this_is_not_a_game_well_it_is_a_game.wav` | A | THE FLOOR IS LAVA. THIS IS NOT A GAME. WELL, IT IS A GAME. |
| `v_vorthax_s_tower_the_carpet_is_nice_the_people_are_not.wav` | A | VORTHAX'S TOWER. THE CARPET IS NICE. THE PEOPLE ARE NOT. |
| `v_gnomes_in_the_night_after_your_potions_wake_up.wav` | A | GNOMES. IN THE NIGHT. AFTER YOUR POTIONS. WAKE UP! |
| `v_a_skeleton_came_too_nobody_invited_him.wav` | A | A SKELETON CAME TOO. NOBODY INVITED HIM. |
| `v_like_people_but_worse_and_crunchier.wav` | A | LIKE PEOPLE, BUT WORSE. AND CRUNCHIER. |
| `v_a_gnome_with_a_sack_of_potions_hit_him_for_science.wav` | A | A GNOME WITH A SACK OF POTIONS. HIT HIM. FOR SCIENCE. |
| `v_they_throw_daggers_rude.wav` | A | THEY THROW DAGGERS. RUDE. |
| `v_slow_stupid_and_sticky_like_a_monday.wav` | A | SLOW, STUPID, AND STICKY. LIKE A MONDAY. |
| `v_they_jump_they_stab_they_lick_things.wav` | A | THEY JUMP. THEY STAB. THEY LICK THINGS. |
| `v_they_are_blue_that_is_the_only_difference.wav` | A | THEY ARE BLUE. THAT IS THE ONLY DIFFERENCE. |
| `v_he_throws_snowballs_the_size_of_cows.wav` | A | HE THROWS SNOWBALLS THE SIZE OF COWS. |
| `v_his_mother_calls_him_little_bjorn_nobody_else_does_twice.wav` | A | HIS MOTHER CALLS HIM LITTLE BJORN. NOBODY ELSE DOES. TWICE. |
| `v_small_red_and_throwing_fire_like_a_toddler_with_a_torch.wav` | A | SMALL, RED AND THROWING FIRE. LIKE A TODDLER WITH A TORCH. |
| `v_please_sign_in_at_the_front_desk_then_kill_it.wav` | A | PLEASE SIGN IN AT THE FRONT DESK. THEN KILL IT. |
| `v_it_was_you_it_was_definitely_you.wav` | A | IT WAS YOU. IT WAS DEFINITELY YOU. |
| `v_skeletons.wav` | A | SKELETONS! |
| `v_cultists.wav` | A | CULTISTS! |
| `v_the_gnome_horde.wav` | A | THE GNOME HORDE! |
| `v_thieves.wav` | A | THIEVES! |
| `v_zombies.wav` | A | ZOMBIES! |
| `v_frogmen.wav` | A | FROGMEN! |
| `v_the_royal_guard.wav` | A | THE ROYAL GUARD! |
| `v_frost_skeletons.wav` | A | FROST SKELETONS! |
| `v_ice_troll.wav` | A | ICE TROLL! |
| `v_avalanche_troll.wav` | A | AVALANCHE TROLL! |
| `v_avalanche_of_idiots.wav` | A | AVALANCHE OF IDIOTS! |
| `v_fire_imps.wav` | A | FIRE IMPS! |
| `v_it_gets_hotter.wav` | A | IT GETS HOTTER! |
| `v_the_lobby.wav` | A | THE LOBBY |
| `v_everybody.wav` | A | EVERYBODY! |
| `v_last_line_of_defence.wav` | A | LAST LINE OF DEFENCE |
| `v_big_mama_hogmother.wav` | A | BIG MAMA HOGMOTHER |
| `v_king_croakus.wav` | A | KING CROAKUS |
| `v_magmor_the_molten.wav` | A | MAGMOR THE MOLTEN |
| `v_vorthax_the_moderately_evil.wav` | A | VORTHAX THE MODERATELY EVIL |
| `v_boss_slain.wav` | A | BOSS SLAIN! |
| `v_dawn_breaks.wav` | A | DAWN BREAKS |
| `v_round_1.wav` | A | ROUND 1 |
| `v_round_2.wav` | A | ROUND 2 |
| `v_round_3.wav` | A | ROUND 3 |
| `v_fight.wav` | A | FIGHT! |
| `v_decapitation.wav` | A | DECAPITATION! |
| `v_butchered.wav` | A | BUTCHERED! |
| `v_flawless_butchery.wav` | A | FLAWLESS BUTCHERY! |
| `v_slaughtered.wav` | A | SLAUGHTERED! |
| `v_maximum_gore.wav` | A | MAXIMUM GORE! |
| `v_metal_mode.wav` | A | METAL MODE! |
| `v_meteor_of_excessive_force.wav` | B | METEOR OF EXCESSIVE FORCE |
| `v_scream_of_the_ancestors.wav` | B | SCREAM OF THE ANCESTORS |
| `v_wrath_of_the_thunder_god.wav` | B | WRATH OF THE THUNDER GOD |

### THRUGG

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_my_biceps_have_no_regrets.wav` | B | MY BICEPS HAVE NO REGRETS. |
| `v_that_was_for_my_village_and_my_other_village.wav` | B | THAT WAS FOR MY VILLAGE. AND MY OTHER VILLAGE. |
| `v_i_will_allow_the_bard_to_exaggerate_this.wav` | B | I WILL ALLOW THE BARD TO EXAGGERATE THIS. |
| `v_steel_is_the_only_diet.wav` | B | STEEL IS THE ONLY DIET. |
| `v_next.wav` | B | NEXT! |
| `v_by_my_loincloth.wav` | B | BY MY LOINCLOTH! |
| `v_the_gods_of_metal_demand_an_encore.wav` | B | THE GODS OF METAL DEMAND AN ENCORE. |
| `v_i_have_oiled_for_this_moment.wav` | B | I HAVE OILED FOR THIS MOMENT. |
| `v_somebody_call_a_priest_not_for_me.wav` | B | SOMEBODY CALL A PRIEST. NOT FOR ME. |
| `v_i_shall_carve_this_into_a_rock_later.wav` | B | I SHALL CARVE THIS INTO A ROCK LATER. |
| `v_is_that_all_i_ask_sincerely.wav` | B | IS THAT ALL? I ASK SINCERELY. |
| `v_flex_flex_again_victory.wav` | B | FLEX. FLEX AGAIN. VICTORY. |
| `v_it_s_just_a_flesh_wound.wav` | B | IT'S JUST A FLESH WOUND! |
| `v_i_wasn_t_using_that_one.wav` | B | I WASN'T USING THAT ONE! |
| `v_i_have_another_one.wav` | B | I HAVE ANOTHER ONE! |
| `v_come_back_here_arm.wav` | B | COME BACK HERE, ARM! |
| `v_that_ll_buff_out.wav` | B | THAT'LL BUFF OUT! |
| `v_i_ll_kick_you_to_death_then.wav` | B | I'LL KICK YOU TO DEATH THEN! |
| `v_my_legs_still_work.wav` | B | MY LEGS STILL WORK! |
| `v_by_crom_s_cousin.wav` | B | BY CROM'S COUSIN! |
| `v_for_the_ham.wav` | B | FOR THE HAM! |
| `v_steel_and_sweat.wav` | B | STEEL AND SWEAT! |
| `v_nice_hair_shame_about_the_head.wav` | B | NICE HAIR. SHAME ABOUT THE HEAD. |

### VALKYRA

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_my_biceps_have_no_regrets_f.wav` | B | MY BICEPS HAVE NO REGRETS. |
| `v_that_was_for_my_village_and_my_other_village_f.wav` | B | THAT WAS FOR MY VILLAGE. AND MY OTHER VILLAGE. |
| `v_i_will_allow_the_bard_to_exaggerate_this_f.wav` | B | I WILL ALLOW THE BARD TO EXAGGERATE THIS. |
| `v_steel_is_the_only_diet_f.wav` | B | STEEL IS THE ONLY DIET. |
| `v_next_f.wav` | B | NEXT! |
| `v_by_my_loincloth_f.wav` | B | BY MY LOINCLOTH! |
| `v_the_gods_of_metal_demand_an_encore_f.wav` | B | THE GODS OF METAL DEMAND AN ENCORE. |
| `v_i_have_oiled_for_this_moment_f.wav` | B | I HAVE OILED FOR THIS MOMENT. |
| `v_somebody_call_a_priest_not_for_me_f.wav` | B | SOMEBODY CALL A PRIEST. NOT FOR ME. |
| `v_i_shall_carve_this_into_a_rock_later_f.wav` | B | I SHALL CARVE THIS INTO A ROCK LATER. |
| `v_is_that_all_i_ask_sincerely_f.wav` | B | IS THAT ALL? I ASK SINCERELY. |
| `v_flex_flex_again_victory_f.wav` | B | FLEX. FLEX AGAIN. VICTORY. |
| `v_this_chainmail_is_fully_functional_f.wav` | B | THIS CHAINMAIL IS FULLY FUNCTIONAL. |
| `v_i_do_not_need_a_prince_i_need_a_bigger_axe_f.wav` | B | I DO NOT NEED A PRINCE. I NEED A BIGGER AXE. |
| `v_my_mother_was_a_valkyrie_my_father_was_a_hammer_f.wav` | B | MY MOTHER WAS A VALKYRIE. MY FATHER WAS A HAMMER. |
| `v_the_red_boots_stay_on_f.wav` | B | THE RED BOOTS STAY ON. |

### VORTHAX

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_so_you_made_it_past_the_motivational_posters.wav` | A | SO. YOU MADE IT PAST THE MOTIVATIONAL POSTERS. |
| `v_prepare_to_be_moderately_destroyed.wav` | A | PREPARE TO BE MODERATELY DESTROYED! |
| `v_behold_my_moderate_form.wav` | A | BEHOLD MY MODERATE FORM! |
| `v_send_everyone_yes_even_kevin.wav` | A | SEND EVERYONE! YES, EVEN KEVIN! |

### PRINCESS AMBERLY

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_finally_can_somebody_please_do_something.wav` | A | FINALLY. CAN SOMEBODY PLEASE DO SOMETHING. |

### BIG MAMA HOGMOTHER

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_who_has_been_killing_my_babies.wav` | A | WHO HAS BEEN KILLING MY BABIES? |
| `v_now_mama_is_angry.wav` | A | NOW MAMA IS ANGRY! |
| `v_children_dinner_time.wav` | A | CHILDREN! DINNER TIME! |

### KING CROAKUS

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_who_dares_disturb_my_royal_nap.wav` | A | WHO DARES DISTURB MY ROYAL NAP? |
| `v_i_will_eat_you_like_a_fly_a_big_sweaty_fly.wav` | A | I WILL EAT YOU LIKE A FLY. A BIG, SWEATY FLY. |
| `v_you_will_croak_for_this.wav` | A | YOU WILL CROAK FOR THIS! |
| `v_royal_guard.wav` | A | ROYAL GUARD! |

### MAGMOR THE MOLTEN

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_i_am_the_mountain_i_am_the_fire.wav` | A | I AM THE MOUNTAIN. I AM THE FIRE. |
| `v_i_am_also_very_lonely_nobody_will_hold_my_hand.wav` | A | I AM ALSO VERY LONELY. NOBODY WILL HOLD MY HAND. |
| `v_i_am_getting_hotter.wav` | A | I AM GETTING HOTTER! |

### TROLL

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_me_not_big_you_small.wav` | A | ME NOT BIG. YOU SMALL. |
| `v_mama_call_me_little_bjorn.wav` | A | MAMA CALL ME LITTLE BJORN! |
| `v_me_sit_on_you_nothing_personal.wav` | A | ME SIT ON YOU. NOTHING PERSONAL. |
| `v_who_ordered_barbarian_me_ordered_barbarian.wav` | A | WHO ORDERED BARBARIAN? ME ORDERED BARBARIAN. |
| `v_troll_hungry.wav` | A | TROLL HUNGRY! |
| `v_you_look_crunchy.wav` | A | YOU LOOK CRUNCHY! |
| `v_me_hate_winter_me_hate_you_more.wav` | A | ME HATE WINTER. ME HATE YOU MORE. |

### SKJELETT

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_rattle_rattle.wav` | C | RATTLE RATTLE! |
| `v_first_day_on_the_job.wav` | C | FIRST DAY ON THE JOB! |
| `v_i_have_no_skin_in_this_game.wav` | C | I HAVE NO SKIN IN THIS GAME! |
| `v_for_vorthax_i_think.wav` | C | FOR VORTHAX! I THINK? |
| `v_my_mom_says_i_m_spooky.wav` | C | MY MOM SAYS I'M SPOOKY! |
| `v_c_c_cold.wav` | C | C-C-COLD... |
| `v_my_marrow_is_frozen.wav` | C | MY MARROW IS FROZEN! |
| `v_chill_out_barbarian.wav` | C | CHILL OUT, BARBARIAN! |
| `v_smells_like_burnt_barbarian.wav` | C | SMELLS LIKE BURNT BARBARIAN! |
| `v_i_m_toasty.wav` | C | I'M TOASTY! |
| `v_extra_crispy.wav` | C | EXTRA CRISPY! |
| `v_worth_it.wav` | C | WORTH IT... |
| `v_tell_my_wife_actually_don_t.wav` | C | TELL MY WIFE... ACTUALLY DON'T |
| `v_i_regret_nothing_wait.wav` | C | I REGRET NOTHING... WAIT |
| `v_my_spleen.wav` | C | MY SPLEEN! |
| `v_not_like_this.wav` | C | NOT LIKE THIS! |
| `v_i_was_two_days_from_retirement.wav` | C | I WAS TWO DAYS FROM RETIREMENT! |

### GRISEMANN

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_oink_i_mean_die.wav` | C | OINK. I MEAN: DIE! |
| `v_hogman_smash.wav` | C | HOGMAN SMASH! |
| `v_i_smell_barbarian.wav` | C | I SMELL BARBARIAN! |
| `v_you_look_like_lunch.wav` | C | YOU LOOK LIKE LUNCH! |
| `v_halt_papers_please.wav` | C | HALT! PAPERS, PLEASE! |
| `v_no_barbarians_after_9pm.wav` | C | NO BARBARIANS AFTER 9PM! |
| `v_oink_of_duty.wav` | C | OINK OF DUTY! |

### KULTIST

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_by_the_dark_one.wav` | C | BY THE DARK ONE! |
| `v_i_m_only_here_for_the_dental_plan.wav` | C | I'M ONLY HERE FOR THE DENTAL PLAN! |
| `v_the_robes_were_free.wav` | C | THE ROBES WERE FREE! |
| `v_hail_vorthax_moderately.wav` | C | HAIL VORTHAX! (MODERATELY) |
| `v_the_master_sees_all.wav` | C | THE MASTER SEES ALL! |
| `v_i_got_promoted.wav` | C | I GOT PROMOTED! |
| `v_senior_cultist_thank_you.wav` | C | SENIOR CULTIST, THANK YOU. |

### GNOME

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_not_the_face.wav` | C | NOT THE FACE! |
| `v_these_are_my_potions.wav` | C | THESE ARE MY POTIONS! |
| `v_help_barbarians.wav` | C | HELP! BARBARIANS! |

### ZOMBIE

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_braaains_or_snacks.wav` | C | BRAAAINS... OR SNACKS |
| `v_moist.wav` | C | MOIST... |
| `v_i_used_to_be_an_accountant.wav` | C | I USED TO BE AN ACCOUNTANT |
| `v_uuuungh_mondays.wav` | C | UUUUNGH. MONDAYS. |

### FROSKEMANN

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_ribbit_prepare_to_die.wav` | C | RIBBIT. PREPARE TO DIE. |
| `v_for_the_king.wav` | C | FOR THE KING! |
| `v_croak_this.wav` | C | CROAK THIS! |
| `v_i_can_lick_my_own_eyeball.wav` | C | I CAN LICK MY OWN EYEBALL |

### IMP

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_hot_hot_hot.wav` | C | HOT HOT HOT! |
| `v_i_m_on_fire_literally.wav` | C | I'M ON FIRE! LITERALLY! |
| `v_catch.wav` | C | CATCH! |
| `v_union_rules_i_get_15_minutes_after_this.wav` | C | UNION RULES. I GET 15 MINUTES AFTER THIS. |
| `v_every_single_tuesday.wav` | C | EVERY. SINGLE. TUESDAY. |
| `v_who_signed_off_on_the_gibs.wav` | C | WHO SIGNED OFF ON THE GIBS? |
| `v_this_is_not_in_my_job_description.wav` | C | THIS IS NOT IN MY JOB DESCRIPTION. |
| `v_i_have_a_degree_you_know.wav` | C | I HAVE A DEGREE, YOU KNOW. |

### DUELLANT

| Fil | Prioritet | Replikk |
|---|---|---|
| `v_is_that_all.wav` | C | IS THAT ALL? |
| `v_tuesday_was_harder.wav` | C | TUESDAY WAS HARDER! |
| `v_i_ve_had_worse_papercuts.wav` | C | I'VE HAD WORSE PAPERCUTS! |
| `v_come_here_little_snack.wav` | C | COME HERE, LITTLE SNACK! |

