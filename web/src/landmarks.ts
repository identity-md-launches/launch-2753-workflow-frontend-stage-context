// One permanent id per ballot stop. Coordinates and ids remain in destinations.ts.
// Art uses a shared 160×110 stage; the path is the stop's distinct geometric silhouette.
export type Landmark = { name: string; path: string };
const kit: [string, string][] = [
  [
    "Southernmost Point buoy",
    "M61 94V63l7-5V39l9-7h7l9 7v19l7 5v31zM64 68h33v5H64zm7-19h19v5H71zm1 31h18v5H72z",
  ],
  [
    "Shark Valley observation tower",
    "M44 90h72v6H44zm23-6V52H46V39l12-8h44l12 8v13H93v32h-8V53H75v31zm-18-43h62v5H49zM77 15h6v16h-6zM51 89l34-23h9L64 89z",
  ],
  [
    "Saturn V rocket",
    "M70 94V38l5-6V19l5-12 5 12v13l5 6v56zM70 47h20v6H70zm0 28h20v6H70zM61 94l9-25v25zm38 0-9-25v25zM76 85h8v12h-8z",
  ],
  [
    "Forsyth Park fountain",
    "M48 93h64v5H48zm9-9h46l-8 7H65zm20-7V62H54l-7-7h66l-7 7H83v15h15l6 6H56l6-6zM60 43h40l-6 8H66zM77 42V24h6v18zm-6-16 9-12 9 12z",
  ],
  [
    "Saint Louis Cathedral",
    "M34 94V55l7-8 7 8v39h8V47l9-8h8V23l7-17 7 17v16h8l9 8v47h8V55l7-8 7 8v39zM74 94V77a6 6 0 0 1 12 0v17zM60 54h6v10h-6zm34 0h6v10h-6zM77 44h6v8h-6z",
  ],
  ["Washington Monument", "M67 96l4-70 9-18 9 18 4 70zM79 27h3v65h-3z"],
  [
    "Statue of Liberty",
    "M60 97v-9h9V61L62 42l7-4 7 15 7-10 9 16-3 29h11v9zM82 42V29h9v13zm2-19 3-13 3 13zM62 38l-5-13 6-3 5 13zM51 19l6-12 7 12zM70 58h5v26h-5z",
  ],
  [
    "Horseshoe Falls",
    "M24 49V29h31v-7h50v7h31v60h-23V45h-12v-8H59v8H47v44H24zm5 3h5v27h-5zm12-10h3v34h-3zm77 6h4v36h-4zm10-7h3v38h-3zM50 90h61v6H50z",
  ],
  [
    "Cloud Gate",
    "M33 76c-1-31 20-48 49-47 27 1 49 19 47 47-1 19-24 19-34 6-5-11-24-11-30 0-11 13-31 12-32-6zM51 69c3-18 15-27 34-27 11 0 20 3 25 9-28-7-48 0-59 18z",
  ],
  [
    "Grand Canyon South Rim",
    "M15 45h31v13h22v15h23V55h18V40h37v14h-19v22h-17v22H51V83H35V67H15zM22 50h19v4H22zm20 20h21v5H42zm19 16h30v4H61zm54-28h16v5h-16z",
  ],
  [
    "Golden Gate Bridge",
    "M32 96V32h7v64zm89 0V32h7v64zM30 28h11v6H30zm89 0h11v6h-11zM39 38q41 61 82 0v7q-41 61-82 0zM16 82h128v6H16zM55 64h4v18h-4zm23 11h4v7h-4zm23-11h4v18h-4z",
  ],
  [
    "Canada Place sails",
    "M17 88h128v7H17zM24 82l19-48 4 48zm25 0 24-65 5 65zm31 0 22-54 4 54zm29 0 19-41 6 41z",
  ],
  [
    "Banff Springs hotel",
    "M26 96V61h18V40l8-13 8 13v56h10V50h19v-9h17V29l7-15 7 15v67h16V60h-8V45l-7-9 17 9v51zM33 69h5v6h-5zm17-20h4v8h-4zm25 14h6v7h-6zm27-12h5v7h-5zm7 19h5v7h-5z",
  ],
  [
    "Palacio de Bellas Artes",
    "M25 96V60h18V49h18V35l8-12h22l8 12v14h18v11h18v36zM66 37h28v7H66zm-28 31h6v19h-6zm17-10h6v29h-6zm17 0h6v29h-6zm17 0h6v29h-6zm17 0h6v29h-6zm17 10h5v19h-5z",
  ],
  [
    "El Castillo pyramid",
    "M25 96V85h13V74h12V63h12V52h10V28h23v24h10v11h12v11h12v11h13v11zM78 96h9V43h-9zM76 33h16v6H76z",
  ],
  [
    "National Theatre of Costa Rica",
    "M27 96V55h106v41zM21 49l59-27 59 27zM39 65h8v22h-8zm25 0h8v22h-8zm25 0h8v22h-8zm25 0h8v22h-8zM77 12h6v13h-6zM21 98h118v5H21z",
  ],
  [
    "Bridge of the Americas",
    "M16 91h128v6H16zM20 87q60-103 120 0h-6q-54-90-108 0zM35 72h5v19h-5zm20-23h4v42h-4zm23-9h4v51h-4zm23 9h4v42h-4zm20 23h4v19h-4z",
  ],
  [
    "Cartagena clock tower",
    "M60 96V48h40v48zM54 43l26-28 26 28zM57 47h46v6H57zM70 65a10 10 0 1 0 20 0 10 10 0 0 0-20 0zM73 96V83a7 7 0 0 1 14 0v13zM24 78h36v18H24zm76 0h36v18h-36z",
  ],
  [
    "Bartolomé Pinnacle Rock",
    "M22 97l28-17 14-51 12-20 9 40 17 22 10 15 25 11zM73 31l-9 48 6-2 7-35zM92 70l6 16h7l-8-16z",
  ],
  [
    "Cusco Cathedral",
    "M31 96V38h23v58h52V38h23v58zM28 33h29v7H28zm75 0h29v7h-29zM55 96V57h50v39zM57 52l23-19 23 19zM70 96V77a10 10 0 0 1 20 0v19zM38 48h9v13h-9zm75 0h9v13h-9zM77 19h6v18h-6zm-6 6h18v5H71z",
  ],
  [
    "Christ the Redeemer",
    "M59 98l8-12 8-36-32-5v-8h32V27h10v10h32v8l-32 5 8 36 8 12zM74 17a7 7 0 1 0 14 0 7 7 0 0 0-14 0z",
  ],
  ["Obelisco", "M69 97l2-62 9-19 9 19 2 62zM78 79h5v12h-5zM22 99h116v5H22z"],
  [
    "Perito Moreno Glacier",
    "M13 96V53l10-12 9 8 9-15 13 14 8-11 13 14 11-20 9 15 12-13 15 16 9-9 15 18v38zM27 58h5v29h-5zm21-4h4v23h-4zm27 9h5v28h-5zm23-10h4v30h-4zm22 6h4v31h-4z",
  ],
  [
    "Hallgrímskirkja",
    "M24 96V81h8V69h8V56h8V42h8V29h8V18h9V9h14v9h9v11h8v13h8v14h8v13h8v12h8v15zM77 96V77h6v19zM77 26h6v18h-6zm-3 7h12v5H74zM60 48h4v38h-4zm36 0h4v38h-4z",
  ],
  [
    "Ha’penny Bridge",
    "M16 91q64-72 128 0l-3 6q-61-62-122 0zM28 80h4v12h-4zm20-13h4v16h-4zm30-8h4v18h-4zm30 8h4v16h-4zm20 13h4v12h-4zM13 99h134v4H13z",
  ],
  [
    "Elizabeth Tower (Big Ben)",
    "M61 96V39h38v57zM57 35h46v7H57zM65 32V21h8V13h4V5h6v8h4v8h8v11zM67 55a13 13 0 1 0 26 0 13 13 0 0 0-26 0zM70 76h5v16h-5zm15 0h5v16h-5z",
  ],
  [
    "Eiffel Tower",
    "M35 98l20-28 10-29 9-27h4V5h4v9h4l9 27 10 29 20 28h-15L98 81H62L50 98zM70 48l-6 18h32l-6-18zM76 25l-6 16h20l-6-16zM53 70h54v6H53z",
  ],
  [
    "Amsterdam canal houses",
    "M23 96V47l9-7v-9h12v9l9 7v49h6V40l8-8v-8h16v8l8 8v56h6V54l10-9V34h12v11l10 9v42zM30 57h7v10h-7zm10 17h7v10h-7zm27-25h8v11h-8zm8 23h8v11h-8zm30-9h8v10h-8zm8 18h8v10h-8z",
  ],
  [
    "Sagrada Família",
    "M31 97l4-56 7-18 7 18 4 56h5l3-66 6-19 6 19 4 66h6l3-66 6-19 6 19 3 66h5l4-56 7-18 7 18 4 56zM69 97V74l11-14 11 14v23zM39 48h5v14h-5zm26-9h4v19h-4zm26 0h4v19h-4zm25 9h5v14h-5z",
  ],
  [
    "Belém Tower",
    "M30 97V76h17V39h50v37h31v21zM43 33h58v8H43zM43 25h8v10h-8zm23 0h10v10H66zm27 0h8v10h-8zM55 48h8v9h-8zm27 0h8v9h-8zM64 97V80h13v17zM48 68h48v6H48zm58 14h9v8h-9z",
  ],
  [
    "Colosseum",
    "M22 95V49l17-13 31-6h41l26 14v51zM32 52h9v13h-9zm18-7h10v17H50zm22-7h10v20H72zm23 0h10v20H95zm23 8h10v16h-10zM31 75h10v15H31zm21-4h10v19H52zm22-4h10v23H74zm23 1h10v22H97zm22 5h10v17h-10z",
  ],
  [
    "Saint Mark’s Campanile",
    "M65 96V39h30v57zM61 32h38v9H61zM64 30l16-25 16 25zM72 40h5v10h-5zm12 0h5v10h-5zM70 56h4v32h-4zm16 0h4v32h-4z",
  ],
  [
    "Matterhorn",
    "M18 98l32-35 18-39 20-19 12 42 12 23 30 28zM87 16 73 33l-8 26 16-8 9 9 8-12z",
  ],
  [
    "Brandenburg Gate",
    "M24 96V52h10v44h13V52h10v44h13V52h10v44h13V52h10v44h13V52h10v44zM18 42h116v10H18zM29 32h95v9H29zM58 28l5-15h8v9h8v-9h8l9 15zM19 98h116v5H19z",
  ],
  [
    "The Little Mermaid",
    "M41 98l11-18 18-5 8-20 15 2 9 16-12 9 25 16zM83 45a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM81 46l-9 4-4 17-15 5 3 6 20-6 6-15zM94 70l12-9 11 4-2 6-10-3-10 13z",
  ],
  [
    "Stockholm City Hall",
    "M22 97V59h76V26h24v71zM94 20h32v8H94zM101 18V9h5v5h8V9h5v9zM30 68h8v14h-8zm17 0h8v14h-8zm17 0h8v14h-8zm17 0h8v14h-8zm23-29h11v11h-11zm3 19h6v30h-6z",
  ],
  [
    "Parthenon",
    "M22 96V88h116v8zM29 49h11v35H29zm23 0h11v35H52zm23 0h11v35H75zm23 0h11v35H98zm23 0h10v35h-10zM18 39l62-22 62 22v7H18zM50 36h60l-30-11z",
  ],
  [
    "Hagia Sophia",
    "M19 97V39h5v58h12V64h12V49h13c0-27 38-27 38 0h13v15h12V39h5v58zM61 57h38v36H61zM77 18h6v7h-6zM36 65l12-15 12 15zm64 0 12-15 12 15zM17 37l4-16 5 16zm105 0 4-16 5 16z",
  ],
  [
    "Koutoubia minaret",
    "M63 96V30h34v66zM60 24h40v8H60zM71 22V12h18v10zM78 4h4v8h-4zM71 39h7v13h-7zm12 0h7v13h-7zM72 62h16v6H72zm0 13h16v6H72z",
  ],
  ["Great Pyramid of Giza", "M17 97 80 18l63 79zM80 28l-43 60h35l17-44z"],
  [
    "Kenyatta International Convention Centre",
    "M56 95V33l7-5h34l7 5v62zM52 23l10-8h36l10 8v6H52zM56 41h48v5H56zm0 13h48v5H56zm0 13h48v5H56zm0 13h48v5H56zM26 96l12-25h13v25z",
  ],
  [
    "Moru Kopjes",
    "M18 98l6-21 21-6 9-22 22-6 14 9 5 17 23 2 24 27zM65 43V22h6v21zM34 21l9-10h50l14 10-12 6H46zM35 80l19-2-5 7H32zm28-25h18l-7 8H58z",
  ],
  [
    "Victoria Falls gorge",
    "M14 36h57v15h-8v44H39V54H14zm61 0h71v18h-25v41H94V52H75zM43 59h5v28h-5zm12-5h4v25h-4zm44 4h4v33h-4zm10-5h4v32h-4zM12 98h136v5H12z",
  ],
  [
    "Table Mountain",
    "M14 97l25-29 6-20h70l7 23 25 26zM47 53l4 5h57l4-5zM47 66h5v19h-5zm13-2h5v24h-5zm36 4h6v20h-6z",
  ],
  [
    "Avenue of the Baobabs",
    "M32 97V45l-12-9V23h5v10l9 4V21h6v17l9-5V21h5v15l-12 9v52zM72 97V32L59 20V9h5v9l10 8V10h7v16l10-8V7h6v15L83 34v63zM115 97V48l-12-10V25h5v10l9 6V25h6v16l10-9V22h5v14l-12 12v49z",
  ],
  [
    "Al-Khazneh (the Treasury)",
    "M33 96V49h94v47zM29 43l51-16 51 16zM45 23l10-12 25 12 25-12 10 12v12H45zM42 57h8v30h-8zm22 0h8v30h-8zm25 0h8v30h-8zm22 0h8v30h-8zM75 96V74h11v22zM77 6h6v16h-6z",
  ],
  [
    "Burj Khalifa",
    "M48 98V79h12V54h9V31h7V13h3V2h3v11h3v18h7v23h9v25h12v19zM79 24h3v66h-3zM64 61h4v28h-4zm32 0h4v28h-4z",
  ],
  [
    "Hawa Mahal",
    "M24 97V46l9-14 10 14 8-21 10 21 9-31 10 31 10-21 9 21 10-14 10 14 9-8 9 15v44zM31 54h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8zM31 73h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8zm18 0h8v9h-8z",
  ],
  [
    "Swayambhunath stupa",
    "M28 98v-8h104v8zM38 86a42 34 0 0 1 84 0zM68 55V38h24v17zM65 33h30v6H65zM72 30V19h16v11zM77 5h6v14h-6zM71 44h6v4h-6zm12 0h6v4h-6z",
  ],
  [
    "Wat Arun",
    "M62 98l4-17h-9l9-18h-6l12-24h-4l10-24h4l10 24h-4l12 24h-6l9 18h-9l4 17zM23 98l6-25h-5l10-22 10 22h-5l6 25zm92 0 6-25h-5l10-22 10 22h-5l6 25z",
  ],
  [
    "Merlion",
    "M46 97l14-12 7-25-8-15 4-16 12-9 20 5 7 14-10 10-2 19 15 17 7 12zM74 32h7v5h-7zm23 10h27v4H97zm-2 6h39v4H95zM70 67l17 7-5 6-16-7zM65 81l24 7-6 5-23-7z",
  ],
  [
    "Angkor Wat",
    "M19 98V78h14V60l6-15 6 15v18h12V51l6-20 6 20v27h5V40l6-26 6 26v38h5V51l6-20 6 20v27h12V60l6-15 6 15v18h14v20zM36 87h8v11h-8zm29 0h8v11h-8zm23 0h8v11h-8zm29 0h8v11h-8z",
  ],
  [
    "Turtle Tower",
    "M52 96V71h56v25zM47 66h66l-9-8H56zM62 56V38h36v18zM56 33h48l-9-9H65zM72 22l8-11 8 11zM61 79h8v13h-8zm16 0h8v13h-8zm17 0h8v13h-8zM72 43h6v10h-6zm11 0h6v10h-6z",
  ],
  [
    "Ulun Danu Beratan temple",
    "M68 98V80h24v18zM51 75l29-11 29 11zM54 60l26-10 26 10zM58 45l22-9 22 9zM62 31l18-8 18 8zM67 18l13-10 13 10zM77 12h6v66h-6zM43 99h74v5H43z",
  ],
  [
    "Bank of China Tower",
    "M51 98V42l31-22 26 20v58zM80 26h5v66h-5zM58 49l42 39v7L58 56zm40-7L58 82v8l44-44zM78 8h4v14h-4zm22 2h4v29h-4z",
  ],
  [
    "Taipei 101",
    "M66 98V88h-7V77l-4-13h6V53l-4-13h7V30l-4-12h15V9h4V2h3v7h4v9h15l-4 12v10h7l-4 13v11h6l-4 13v11h-7v10zM68 33h24v4H68zm-2 23h28v4H66zm0 24h28v4H66z",
  ],
  [
    "Gyeongbokgung Gwanghwamun gate",
    "M34 98V69h92v29zM20 65l13-4 13-13h68l13 13 13 4v5H20zM38 40l10-4 12-13h40l12 13 10 4v5H38zM50 46h60v10H50zM47 98V83a7 7 0 0 1 14 0v15zm26 0V80a7 7 0 0 1 14 0v18zm26 0V83a7 7 0 0 1 14 0v15z",
  ],
  [
    "Fushimi Inari torii",
    "M39 98V35h9v63zm73 0V35h9v63zM22 24l10 4h96l10-4v12l-12 3H34l-12-3zM32 46h96v9H32zM76 34h8v20h-8z",
  ],
  [
    "Tokyo Tower",
    "M41 98l20-29 9-30 7-21V8h6v10l7 21 9 30 20 29h-13L94 80H66L54 98zM74 42l-7 23h26l-7-23zM65 29h30v6H65zM54 69h52v7H54zM62 84h36v6H62z",
  ],
  [
    "Heart Reef",
    "M80 96C9 59 21 23 50 26c14 1 22 9 30 19 8-10 16-18 30-19 29-3 41 33-30 70zM80 79C36 54 41 39 53 41c12 1 19 12 27 18 8-6 15-17 27-18 12-2 17 13-27 38z",
  ],
  [
    "Sydney Opera House",
    "M20 94h124v6H20zM27 87 39 53l26 34zM50 85l10-62 34 62zM86 85l13-48 27 48zM120 86l5-25 20 25z",
  ],
  [
    "Uluru",
    "M17 96V77l7-8 10-21 20-11 49-3 18 10 14 5 11 23v24zM38 61h5v26h-5zm19-15h4v39h-4zm22-6h4v44h-4zm23 5h4v42h-4zm21 13h4v30h-4z",
  ],
  [
    "Bob’s Peak gondola",
    "M14 98l38-39 24-27 33 32 37 34zM16 28l126 29v4L16 32zM90 45h4v15h-4zM80 60h24l5 8v20H75V68zM81 68h9v11h-9zm13 0h9v11h-9z",
  ],
  [
    "Diamond Head",
    "M15 98l10-22 26-18 21-20 23 7 20 22 26 31zM49 66l22-19 20 6 11 13-27-9zM57 74l17-10 25 11-19-4z",
  ],
];
export const LANDMARKS: readonly Landmark[] = kit.map(([name, path]) => ({
  name,
  path,
}));
