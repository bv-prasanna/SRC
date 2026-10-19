package in.srcenterprises.api;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface CatalogRepository extends JpaRepository<CatalogItem,Long>{
  List<CatalogItem> findAllByPublishedTrueOrderByNameAsc();
}
