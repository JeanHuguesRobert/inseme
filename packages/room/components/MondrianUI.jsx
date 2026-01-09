import React from "react";

/**
 * MondrianBlock - Un bloc modulaire inspiré du style de Piet Mondrian.
 * 
 * @param {string} color - 'red', 'blue', 'yellow', 'white', 'black'
 * @param {string} span - Classes Tailwind pour le span de la grille (ex: 'col-span-2 row-span-1')
 * @param {React.ReactNode} children - Contenu du bloc
 * @param {string} className - Classes additionnelles
 */
export const MondrianBlock = ({ color = "white", span = "", children, className = "" }) => {
  const colorMap = {
    red: "bg-[#E10600] text-white",
    blue: "bg-[#0055A4] text-white",
    yellow: "bg-[#FFD500] text-black",
    black: "bg-black text-white",
    white: "bg-white text-black",
    gray: "bg-slate-100 text-black",
  };

  return (
    <div
      className={`
        border-4 border-black p-6 flex flex-col justify-between transition-all
        ${colorMap[color] || colorMap.white}
        ${span}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

/**
 * MondrianUI - Une interface web responsive complète inspirée de Piet Mondrian.
 */
export function MondrianUI() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border-4 border-black mb-8">
          <MondrianBlock 
            color="white" 
            span="md:col-span-8"
            className="border-r-0 md:border-r-4 border-b-4 md:border-b-0"
          >
            <div>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-4">
                Composition <br /> En Couleurs
              </h1>
              <p className="text-sm font-bold uppercase tracking-[0.3em] opacity-60">
                Inspiré par Piet Mondrian
              </p>
            </div>
          </MondrianBlock>
          
          <MondrianBlock 
            color="red" 
            span="md:col-span-4"
            className="min-h-[150px]"
          >
            <div className="flex justify-end items-start">
              <span className="text-xs font-black border-2 border-white px-2 py-1">1921</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black uppercase">Néo-plasticisme</span>
            </div>
          </MondrianBlock>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border-4 border-black">
          
          {/* Sidebar Area */}
          <div className="md:col-span-3 grid grid-cols-1 divide-y-4 divide-black border-r-4 border-black">
            <MondrianBlock color="blue" className="aspect-square">
              <h2 className="text-2xl font-black uppercase">Navigation</h2>
              <ul className="space-y-2 mt-4">
                {['Accueil', 'Galerie', 'Archives', 'Manifeste'].map(item => (
                  <li key={item} className="group cursor-pointer flex items-center gap-2">
                    <div className="w-4 h-4 bg-white border-2 border-black group-hover:bg-yellow-400 transition-colors" />
                    <span className="text-sm font-black uppercase group-hover:translate-x-1 transition-transform">{item}</span>
                  </li>
                ))}
              </ul>
            </MondrianBlock>
            
            <MondrianBlock color="white">
              <p className="text-xs font-bold leading-relaxed italic">
                "L'art ne doit pas être une reproduction de la réalité, mais une expression de la réalité pure."
              </p>
            </MondrianBlock>

            <MondrianBlock color="yellow" className="h-32">
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl font-black">?</span>
              </div>
            </MondrianBlock>
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-9 grid grid-cols-1 md:grid-cols-9 divide-y-4 md:divide-y-0 divide-black">
            
            {/* Top Row */}
            <div className="md:col-span-9 grid grid-cols-1 md:grid-cols-9 divide-x-0 md:divide-x-4 divide-black border-b-4 border-black">
              <MondrianBlock color="white" span="md:col-span-6" className="p-8">
                <h3 className="text-3xl font-black uppercase mb-6">Le Manifeste du Style</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <p className="text-sm leading-relaxed">
                    Nous parlons d'une grille de lignes noires horizontales et verticales qui délimitent des rectangles de couleurs primaires. C'est l'essence même de l'équilibre asymétrique.
                  </p>
                  <p className="text-sm leading-relaxed">
                    Chaque bloc a sa propre importance. Le vide (blanc) est aussi crucial que le plein (couleur). C'est une architecture de la pensée pure appliquée au web.
                  </p>
                </div>
              </MondrianBlock>
              
              <div className="md:col-span-3 grid grid-cols-1 divide-y-4 divide-black">
                <MondrianBlock color="black" className="hover:bg-red-600 cursor-pointer">
                  <span className="text-xs font-black uppercase tracking-widest">Action 01</span>
                  <span className="text-2xl font-black uppercase">Explorer</span>
                </MondrianBlock>
                <MondrianBlock color="white" className="hover:bg-blue-600 hover:text-white cursor-pointer">
                  <span className="text-xs font-black uppercase tracking-widest text-blue-600 group-hover:text-white">Action 02</span>
                  <span className="text-2xl font-black uppercase">Créer</span>
                </MondrianBlock>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="md:col-span-9 grid grid-cols-1 md:grid-cols-9 divide-x-0 md:divide-x-4 divide-black">
              <MondrianBlock color="yellow" span="md:col-span-3" className="aspect-video md:aspect-auto">
                <div className="flex flex-col h-full justify-center items-center">
                  <div className="text-6xl font-black">80%</div>
                  <div className="text-[10px] font-black uppercase tracking-widest">Abstraction</div>
                </div>
              </MondrianBlock>

              <MondrianBlock color="white" span="md:col-span-4" className="p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-black w-3/4" />
                  <div className="h-4 bg-[#E10600] w-full" />
                  <div className="h-4 bg-[#0055A4] w-1/2" />
                  <p className="text-[10px] font-bold uppercase pt-4">
                    Visualisation de données asymétrique.
                  </p>
                </div>
              </MondrianBlock>

              <MondrianBlock color="blue" span="md:col-span-2">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 border-4 border-white flex items-center justify-center animate-spin">
                    <div className="w-4 h-4 bg-white" />
                  </div>
                  <span className="text-[10px] font-black uppercase">Chargement...</span>
                </div>
              </MondrianBlock>
            </div>

          </div>
        </div>

        {/* Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border-4 border-black mt-8">
          <MondrianBlock color="white" span="md:col-span-10" className="border-r-0 md:border-r-4 border-b-4 md:border-b-0">
            <div className="flex flex-wrap gap-8">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">Localisation</span>
                <p className="text-sm font-black uppercase">De Stijl, Pays-Bas</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">Contact</span>
                <p className="text-sm font-black uppercase">info@mondrian.ui</p>
              </div>
            </div>
          </MondrianBlock>
          <MondrianBlock color="black" span="md:col-span-2" className="flex items-center justify-center cursor-pointer hover:bg-[#FFD500] hover:text-black transition-colors">
            <span className="text-2xl font-black">↑</span>
          </MondrianBlock>
        </div>
      </div>
    </div>
  );
}
