import PropositionList from "../components/kudocracy/PropositionList";
import { Link } from "react-router-dom";

export default function PropositionListPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
         <h1 className="text-2xl font-bold">Propositions</h1>
         <Link to="/propositions/new" className="px-4 py-2 bg-black text-white rounded">
            + Nouvelle Proposition
         </Link>
      </div>
      <PropositionList />
    </div>
  );
}
