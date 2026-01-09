import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDemandes, getDemande, createDemande, updateDemande } from "../services/api/demandes.js";
import { useAuth } from "../contexts/AuthContext";

export function useDemandesList(params = {}) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery(["demandes", params], () => listDemandes({ ...params, token }));
}

export function useDemande(id) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery(["demande", id], () => getDemande(id, { token }), { enabled: !!id });
}

export function useCreateDemande() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;
  return useMutation((payload) => createDemande(payload, { token }), {
    onSuccess: () => qc.invalidateQueries(["demandes"]),
  });
}

export function useUpdateDemande() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;
  return useMutation(({ id, payload }) => updateDemande(id, payload, { token }), {
    onSuccess: (_, vars) => qc.invalidateQueries(["demande", vars.id]),
  });
}
