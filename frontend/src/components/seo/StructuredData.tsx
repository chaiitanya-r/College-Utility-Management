import { useEffect } from 'react';

interface StructuredDataProps {
  schema: Record<string, unknown>;
  id?: string;
}

const StructuredData: React.FC<StructuredDataProps> = ({ schema, id = 'structured-data-default' }) => {
  useEffect(() => {
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [schema, id]);

  return null;
};

export default StructuredData;
