import { motion } from "framer-motion";

interface AccountCardProps {
  name: string;
  category: string;
  status: string;
  imageUrl?: string;
  onClick: () => void;
  index: number;
}

export function AccountCard({ name, category, status, imageUrl, onClick, index }: AccountCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -6, scale: 1.03 }}
      onClick={onClick}
      className="glass rounded-2xl p-5 cursor-pointer group relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl neon-glow pointer-events-none" />
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl gradient-neon flex items-center justify-center overflow-hidden shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <span className="text-2xl font-bold text-primary-foreground">{name[0]}</span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground truncate">{name}</h3>
          <p className="text-sm text-muted-foreground">{category}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${status === "active" ? "bg-green-400" : "bg-red-400"}`} />
        <span className="text-xs text-muted-foreground">
          {status === "active" ? "Disponível" : "Indisponível"}
        </span>
      </div>
    </motion.div>
  );
}
