-- Kjør dette i Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- Setter inn alle lag og kamper for VM 2026

-- Teams
INSERT INTO teams (name, group_name, flag) VALUES
  ('Mexico','A','🇲🇽'),('South Africa','A','🇿🇦'),('South Korea','A','🇰🇷'),('Czechia','A','🇨🇿'),
  ('Canada','B','🇨🇦'),('Bosnia and Herzegovina','B','🇧🇦'),('Qatar','B','🇶🇦'),('Switzerland','B','🇨🇭'),
  ('Brazil','C','🇧🇷'),('Morocco','C','🇲🇦'),('Haiti','C','🇭🇹'),('Scotland','C','🏴󠁧󠁢󠁳󠁣󠁴󠁿'),
  ('USA','D','🇺🇸'),('Paraguay','D','🇵🇾'),('Australia','D','🇦🇺'),('Turkey','D','🇹🇷'),
  ('Germany','E','🇩🇪'),('Curaçao','E','🇨🇼'),('Ivory Coast','E','🇨🇮'),('Ecuador','E','🇪🇨'),
  ('Netherlands','F','🇳🇱'),('Japan','F','🇯🇵'),('Sweden','F','🇸🇪'),('Tunisia','F','🇹🇳'),
  ('Belgium','G','🇧🇪'),('Egypt','G','🇪🇬'),('Iran','G','🇮🇷'),('New Zealand','G','🇳🇿'),
  ('Spain','H','🇪🇸'),('Cape Verde','H','🇨🇻'),('Saudi Arabia','H','🇸🇦'),('Uruguay','H','🇺🇾'),
  ('France','I','🇫🇷'),('Senegal','I','🇸🇳'),('Iraq','I','🇮🇶'),('Norway','I','🇳🇴'),
  ('Argentina','J','🇦🇷'),('Algeria','J','🇩🇿'),('Austria','J','🇦🇹'),('Jordan','J','🇯🇴'),
  ('Portugal','K','🇵🇹'),('DR Congo','K','🇨🇩'),('Uzbekistan','K','🇺🇿'),('Colombia','K','🇨🇴'),
  ('England','L','🏴󠁧󠁢󠁥󠁮󠁧󠁿'),('Croatia','L','🇭🇷'),('Ghana','L','🇬🇭'),('Panama','L','🇵🇦')
ON CONFLICT (name) DO NOTHING;

-- Group A matches (md1: 2026-06-11, md2: 2026-06-18, md3: 2026-06-25)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Mexico','South Africa','group','A',1,'2026-06-11','18:00'),
  ('South Korea','Czechia','group','A',1,'2026-06-11','21:00'),
  ('Mexico','South Korea','group','A',2,'2026-06-18','21:00'),
  ('South Africa','Czechia','group','A',2,'2026-06-18','21:00'),
  ('Mexico','Czechia','group','A',3,'2026-06-25','00:00'),
  ('South Africa','South Korea','group','A',3,'2026-06-25','00:00');

-- Group B matches (md1: 2026-06-12, md2: 2026-06-18, md3: 2026-06-25)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Canada','Bosnia and Herzegovina','group','B',1,'2026-06-12','18:00'),
  ('Qatar','Switzerland','group','B',1,'2026-06-12','21:00'),
  ('Canada','Qatar','group','B',2,'2026-06-18','21:00'),
  ('Bosnia and Herzegovina','Switzerland','group','B',2,'2026-06-18','21:00'),
  ('Canada','Switzerland','group','B',3,'2026-06-25','00:00'),
  ('Bosnia and Herzegovina','Qatar','group','B',3,'2026-06-25','00:00');

-- Group C matches (md1: 2026-06-13, md2: 2026-06-19, md3: 2026-06-25)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Brazil','Morocco','group','C',1,'2026-06-13','18:00'),
  ('Haiti','Scotland','group','C',1,'2026-06-13','21:00'),
  ('Brazil','Haiti','group','C',2,'2026-06-19','21:00'),
  ('Morocco','Scotland','group','C',2,'2026-06-19','21:00'),
  ('Brazil','Scotland','group','C',3,'2026-06-25','00:00'),
  ('Morocco','Haiti','group','C',3,'2026-06-25','00:00');

-- Group D matches (md1: 2026-06-12, md2: 2026-06-19, md3: 2026-06-25)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('USA','Paraguay','group','D',1,'2026-06-12','18:00'),
  ('Australia','Turkey','group','D',1,'2026-06-12','21:00'),
  ('USA','Australia','group','D',2,'2026-06-19','21:00'),
  ('Paraguay','Turkey','group','D',2,'2026-06-19','21:00'),
  ('USA','Turkey','group','D',3,'2026-06-25','00:00'),
  ('Paraguay','Australia','group','D',3,'2026-06-25','00:00');

-- Group E matches (md1: 2026-06-14, md2: 2026-06-20, md3: 2026-06-26)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Germany','Curaçao','group','E',1,'2026-06-14','18:00'),
  ('Ivory Coast','Ecuador','group','E',1,'2026-06-14','21:00'),
  ('Germany','Ivory Coast','group','E',2,'2026-06-20','21:00'),
  ('Curaçao','Ecuador','group','E',2,'2026-06-20','21:00'),
  ('Germany','Ecuador','group','E',3,'2026-06-26','00:00'),
  ('Curaçao','Ivory Coast','group','E',3,'2026-06-26','00:00');

-- Group F matches (md1: 2026-06-14, md2: 2026-06-20, md3: 2026-06-26)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Netherlands','Japan','group','F',1,'2026-06-14','18:00'),
  ('Sweden','Tunisia','group','F',1,'2026-06-14','21:00'),
  ('Netherlands','Sweden','group','F',2,'2026-06-20','21:00'),
  ('Japan','Tunisia','group','F',2,'2026-06-20','21:00'),
  ('Netherlands','Tunisia','group','F',3,'2026-06-26','00:00'),
  ('Japan','Sweden','group','F',3,'2026-06-26','00:00');

-- Group G matches (md1: 2026-06-15, md2: 2026-06-21, md3: 2026-06-26)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Belgium','Egypt','group','G',1,'2026-06-15','18:00'),
  ('Iran','New Zealand','group','G',1,'2026-06-15','21:00'),
  ('Belgium','Iran','group','G',2,'2026-06-21','21:00'),
  ('Egypt','New Zealand','group','G',2,'2026-06-21','21:00'),
  ('Belgium','New Zealand','group','G',3,'2026-06-26','00:00'),
  ('Egypt','Iran','group','G',3,'2026-06-26','00:00');

-- Group H matches (md1: 2026-06-15, md2: 2026-06-21, md3: 2026-06-26)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Spain','Cape Verde','group','H',1,'2026-06-15','18:00'),
  ('Saudi Arabia','Uruguay','group','H',1,'2026-06-15','21:00'),
  ('Spain','Saudi Arabia','group','H',2,'2026-06-21','21:00'),
  ('Cape Verde','Uruguay','group','H',2,'2026-06-21','21:00'),
  ('Spain','Uruguay','group','H',3,'2026-06-26','00:00'),
  ('Cape Verde','Saudi Arabia','group','H',3,'2026-06-26','00:00');

-- Group I matches (md1: 2026-06-16, md2: 2026-06-22, md3: 2026-06-27)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('France','Senegal','group','I',1,'2026-06-16','18:00'),
  ('Iraq','Norway','group','I',1,'2026-06-16','21:00'),
  ('France','Iraq','group','I',2,'2026-06-22','21:00'),
  ('Senegal','Norway','group','I',2,'2026-06-22','21:00'),
  ('France','Norway','group','I',3,'2026-06-27','00:00'),
  ('Senegal','Iraq','group','I',3,'2026-06-27','00:00');

-- Group J matches (md1: 2026-06-16, md2: 2026-06-22, md3: 2026-06-27)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Argentina','Algeria','group','J',1,'2026-06-16','18:00'),
  ('Austria','Jordan','group','J',1,'2026-06-16','21:00'),
  ('Argentina','Austria','group','J',2,'2026-06-22','21:00'),
  ('Algeria','Jordan','group','J',2,'2026-06-22','21:00'),
  ('Argentina','Jordan','group','J',3,'2026-06-27','00:00'),
  ('Algeria','Austria','group','J',3,'2026-06-27','00:00');

-- Group K matches (md1: 2026-06-17, md2: 2026-06-23, md3: 2026-06-27)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('Portugal','DR Congo','group','K',1,'2026-06-17','18:00'),
  ('Uzbekistan','Colombia','group','K',1,'2026-06-17','21:00'),
  ('Portugal','Uzbekistan','group','K',2,'2026-06-23','21:00'),
  ('DR Congo','Colombia','group','K',2,'2026-06-23','21:00'),
  ('Portugal','Colombia','group','K',3,'2026-06-27','00:00'),
  ('DR Congo','Uzbekistan','group','K',3,'2026-06-27','00:00');

-- Group L matches (md1: 2026-06-18, md2: 2026-06-24, md3: 2026-06-27)
INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time) VALUES
  ('England','Croatia','group','L',1,'2026-06-18','18:00'),
  ('Ghana','Panama','group','L',1,'2026-06-18','21:00'),
  ('England','Ghana','group','L',2,'2026-06-24','21:00'),
  ('Croatia','Panama','group','L',2,'2026-06-24','21:00'),
  ('England','Panama','group','L',3,'2026-06-27','00:00'),
  ('Croatia','Ghana','group','L',3,'2026-06-27','00:00');

-- Round of 32 (2026-06-29)
INSERT INTO matches (home_team,away_team,stage,match_date,match_time,label) VALUES
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe A vs 3.plass C/D/E/F'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe C vs Vinner gruppe D'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe B vs 3.plass A/B/C/D'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe D vs Vinner gruppe A'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe E vs 3.plass G/H/I/J'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe G vs Vinner gruppe H'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe F vs 3.plass E/F/G/H'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe H vs Vinner gruppe E'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe I vs 3.plass K/L/A/B'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe K vs Vinner gruppe L'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe J vs 3.plass I/J/K/L'),
  ('TBD','TBD','r32','2026-06-29','21:00','Vinner gruppe L vs Vinner gruppe K'),
  ('TBD','TBD','r32','2026-06-29','21:00','2.plass gruppe B vs 2.plass gruppe A'),
  ('TBD','TBD','r32','2026-06-29','21:00','2.plass gruppe D vs 2.plass gruppe C'),
  ('TBD','TBD','r32','2026-06-29','21:00','2.plass gruppe F vs 2.plass gruppe E'),
  ('TBD','TBD','r32','2026-06-29','21:00','2.plass gruppe H vs 2.plass gruppe G');

-- Round of 16 (2026-07-03)
INSERT INTO matches (home_team,away_team,stage,match_date,match_time,label) VALUES
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 1'),
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 2'),
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 3'),
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 4'),
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 5'),
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 6'),
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 7'),
  ('TBD','TBD','r16','2026-07-03','21:00','Åttedelsfinale 8');

-- Quarter-finals (2026-07-10)
INSERT INTO matches (home_team,away_team,stage,match_date,match_time,label) VALUES
  ('TBD','TBD','qf','2026-07-10','21:00','Kvartfinale 1'),
  ('TBD','TBD','qf','2026-07-10','21:00','Kvartfinale 2'),
  ('TBD','TBD','qf','2026-07-10','21:00','Kvartfinale 3'),
  ('TBD','TBD','qf','2026-07-10','21:00','Kvartfinale 4');

-- Semi-finals (2026-07-14)
INSERT INTO matches (home_team,away_team,stage,match_date,match_time,label) VALUES
  ('TBD','TBD','sf','2026-07-14','21:00','Semifinale 1'),
  ('TBD','TBD','sf','2026-07-14','21:00','Semifinale 2');

-- 3rd place + Final
INSERT INTO matches (home_team,away_team,stage,match_date,match_time,label) VALUES
  ('TBD','TBD','3rd','2026-07-18','21:00','Bronsefinale'),
  ('TBD','TBD','final','2026-07-19','21:00','VM-finale 🏆');
