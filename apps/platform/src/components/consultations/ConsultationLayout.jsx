// src/components/consultations/ConsultationLayout.jsx
// Version factorisée utilisant @inseme/brique-kudocracy

import { ConsultationLayout as BriqueLayout } from "@inseme/brique-kudocracy";
import GestureHeaderMenu from "../layout/GestureHeaderMenu";
import SiteFooter from "../layout/SiteFooter";
import FacebookPagePlugin from "../common/FacebookPagePlugin";

export default function ConsultationLayout(props) {
  return (
    <BriqueLayout
      {...props}
      Header={GestureHeaderMenu}
      Footer={SiteFooter}
      FacebookPlugin={FacebookPagePlugin}
    />
  );
}

export { PieChartSection, BarChartSection, ScoreSection } from "@inseme/brique-kudocracy";
